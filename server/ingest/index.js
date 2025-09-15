import { Inngest } from "inngest";
import User from "../models/User.js";
import ConnectDb from "../configs/db.js";
import Booking from "../models/Booking.js";
import Show from "../models/Shows.js";
import sendMail from "../configs/nodemailer.js";
// Create a client to send and receive events
export const inngest = new Inngest({ id: "movie-ticket-booking" });

//inngestfunction to save user
const syncUser = inngest.createFunction(
  { id: 'sync-user-from-clerk' }, // ←The 'id' is an arbitrary string used to identify the function in the dashboard
  { event: 'clerk/user.created' }, // ← This is the function's triggering event

  async ({ event }) => {
    const user = event.data // The event payload's data will be the Clerk User json object
    console.log("user", user);

    const { id, first_name, last_name, email_addresses, image_url } = user
    const userData = {
      _id: id,
      email: email_addresses[0].email_address,
      name: first_name + ' ' + last_name,
      image: image_url
    }
    await User.create(userData)
  },
)
//inngestfunction to DELETE user
const syncUserDeletion = inngest.createFunction(
  { id: 'delete-user-with-clerk' }, // ←The 'id' is an arbitrary string used to identify the function in the dashboard
  { event: 'clerk/user.deleted' }, // ← This is the function's triggering event

  async ({ event }) => {
    const { id } = event.data
    await User.findByIdAndDelete(id)
  },
)
//inngestfunction to update user
const syncUserUdation = inngest.createFunction(
  { id: 'update-user-with-clerk' }, // ←The 'id' is an arbitrary string used to identify the function in the dashboard
  { event: 'clerk/user.updated' }, // ← This is the function's triggering event

  async ({ event }) => {
    await ConnectDb();
    const user = event.data // The event payload's data will be the Clerk User json object
    const { id, first_name, last_name, email_addresses, image_url } = user
    const userData = {
      _id: id,
      email: email_addresses[0].email_address,
      name: first_name + ' ' + last_name,
      image: image_url
    }
    await User.findByIdAndUpdate(userData._id, userData, { new: true })
  },
)

// Inngest Function to cancel booking and release seats of show after
//  10 minutes of booking created if payment is not made

const releaseSeatsAndDeleteBooking = inngest.createFunction(
  { id: 'release-seats-delete-booking' },
  { event: "app/checkpayment" },
  async ({ event, step }) => {
    const tenMinutesLater = new Date(Date.now() + 10 * 60 * 1000);
    await step.sleepUntil('wait-for-10-minutes', tenMinutesLater)

    await step.run('check-payment-status', async () => {
      const bookingId = event.data.bookingId
      const booking = await Booking.findById(bookingId)
      //If payment is not made,release the seats and delete booking
      if (!booking.isPaid) {
        const show = await Show.findById(booking.show);
        booking.bookedSeats.forEach((seat) => delete show.occupiedSeats[seat])

        show.markModified('occupiedSeats')
        await show.save()
        await Booking.findByIdAndDelete(booking._id)
      }
    })

  }
)

//Inngest Function to send email when user books a show

const sendBookingConfirmationEmail = inngest.createFunction(
  { id: "send-booking-confirmation-email" },
  { event: "app/show.booked" },
  async ({ event, step }) => {
    const { bookingId } = event.data;
    const booking = await Booking.findById(bookingId).populate({
      path: 'show',
      populate: { path: 'movie', model: 'Movie' }
    }).populate('user')


    console.log(booking);

    await sendMail({
      to: booking.user.email,
      subject: `Payment Confirmation "${booking.show.movie.title}" booked !`,
      body: `<div style="font-family: Arial, sans-serif; background-color:#f4f4f4; padding:20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto; background:#fff; border-radius:8px; overflow:hidden;">
    <tr>
      <td style="background:#2c3e50; padding:20px; text-align:center; color:#fff;">
        <h1 style="margin:0;">🎬 ${booking.show.movie.title} booked!</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:20px; color:#333;">
        <p>Hi <strong>${booking.user.name}</strong>,</p>
        <p>Your ticket booking was successful. Here are your details:</p>
        <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #ddd; border-radius:6px;">
          <tr>
            <td><strong>Movie</strong></td>
            <td>${booking.show.movie.title}</td>
          </tr>
          <tr style="background:#f9f9f9;">
            <td><strong>Date</strong></td>
            <td>${new Date(booking.show.showDateTime).toLocaleDateString('en-US', {
        timeZone: 'Asia/Kolkata'
      })}</td>
          </tr>
          <tr>
            <td><strong>Time</strong></td>
            <td>${new Date(booking.show.showDateTime).toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata'
      })}</td>
          </tr>
        
        </table>
        <p style="margin-top:20px;">Please arrive at the theater at least <strong>15 minutes before showtime</strong>.</p>
        <p style="margin-top:20px;">Enjoy your movie! 🍿</p>
      </td>
    </tr>
    <tr>
      <td style="background:#2c3e50; text-align:center; color:#fff; padding:10px;">
        <small>&copy; 2025 Movie Ticket App</small>
      </td>
    </tr>
  </table>
</div>`
    })
  }
)

// Inngest Function  to send reminders

const sendShowReminders = inngest.createFunction(
  { id: 'send-show-reminders' },
  { cron: "0*/8 * * *" }, //every 8 hrs
  async ({ step }) => {
    const now = new Date();
    const in8Hours = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const windowStart = new Date(in8Hours.getTime() - 10 * 60 * 1000)

    //Prepare reminder tasks
    const reminderTasks = await step.run("prepare-reminder-tasks", async () => {
      const shows = await Show.find({
        showTime: { $gte: windowStart, $lte: in8Hours }
      }).populate('movie');

      const tasks = [];
      for (const show of shows) {
        if (!show.movie || !show.occupiedSeats) continue

        const userIds = [...new Set(Object.values(show.occupiedSeats))];// Each userid of that show
        if (userIds.length === 0) continue;

        const users = await User.find({ _id: { $in: userIds } }).select("name email")
        for (const user of users) {
          tasks.push({
            userEmail: user.email,
            userName: user.name,
            movieTitle: show.movie.title,
            showTime: show.showTime
          })
        }
      }
      return tasks;
    })
    if (reminderTasks.length === 0) return { send: 0, message: "No reminders to send" }

    //Send reminders emails
    const results = await step.run('send-all-reminders', async () => {
      return await Promise.allSettled(
        reminderTasks.map(task => sendBookingConfirmationEmail({
          to: task.userEmail,
          subject: `Payment Confirmation "${task.movieTitle}" booked !`,
          body: `<div style="font-family: Arial, sans-serif; background-color:#f4f4f4; padding:20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:auto; background:#fff; border-radius:8px; overflow:hidden;">
    <tr>
      <td style="background:#2c3e50; padding:20px; text-align:center; color:#fff;">
        <h1 style="margin:0;">🎬 ${task.movieTitle} booked!</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:20px; color:#333;">
        <p>Hi <strong>${task.userName}</strong>,</p>
        <p>Your ticket task was successful. Here are your details:</p>
        <table width="100%" cellpadding="8" cellspacing="0" style="border:1px solid #ddd; border-radius:6px;">
          <tr>
            <td><strong>Movie</strong></td>
            <td>${task.movieTitle}</td>
          </tr>
          <tr style="background:#f9f9f9;">
            <td><strong>Date</strong></td>
            <td>${new Date(task.showTime).toLocaleDateString('en-US', {
            timeZone: 'Asia/Kolkata'
          })}</td>
          </tr>
          <tr>
            <td><strong>Time</strong></td>
            <td>${new Date(task.showTime).toLocaleTimeString('en-US', {
            timeZone: 'Asia/Kolkata'
          })}</td>
          </tr>
        
        </table>
        <p style="margin-top:20px;">Please arrive at the theater at least <strong>15 minutes before showtime</strong>.</p>
        <p style="margin-top:20px;">Enjoy your movie! 🍿</p>
      </td>
    </tr>
    <tr>
      <td style="background:#2c3e50; text-align:center; color:#fff; padding:10px;">
        <small>&copy; 2025 Movie Ticket App</small>
      </td>
    </tr>
  </table>
</div>`
        }))
      )
    })
    const send = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - send;
    return {
      send, failed, message: `Send ${send} reminder(s),${failed} failed.`
    }
  }
)

//Inngest Function to send notification when a new show is added
const sendNewShowNotifications = inngest.createFunction({
  id: "send-new-show-notifications"
},
  { event: "app/show.added" },
  async ({ event }) => {
    const { movieTitle } = event.data
    const users = await User.find({})
    for (const user of users) {
      const userEmail = user.email;
      const userName = user.name;
      const subject = `New Show Added:${movieTitle}`
      const body = `
  <div style="font-family: Arial, sans-serif; padding:20px; background:#f9f9f9; border-radius:8px;">
    <h2 style="color:#2c3e50;">🎬 New Show Added!</h2>
    <p>Hi <strong>${userName}</strong>,</p>
    <p>We’re excited to let you know that a new show has been added:</p>
    <div style="padding:10px; background:#fff; border:1px solid #ddd; border-radius:6px; margin:10px 0;">
      <p><strong>Movie:</strong> ${movieTitle}</p>
    </div>
    <p>Book your tickets now and don’t miss out! 🍿</p>
    <p style="margin-top:20px; font-size:12px; color:#888;">&copy; 2025 Movie Ticket App</p>
  </div>
`;
      await sendMail(
        {
          to: userEmail, subject, body
        }
      )
    }
    return {message:"Notification send"}
  })




// Create an empty array where we'll export future Inngest functions
export const functions = [syncUser, syncUserDeletion,
  syncUserUdation, releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail, sendShowReminders,sendNewShowNotifications];