import { Inngest } from "inngest";
import User from "../models/User.js";
import ConnectDb from "../configs/db.js";
import Booking from "../models/Booking.js";
import Show from "../models/Shows.js";

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

// Create an empty array where we'll export future Inngest functions
export const functions = [syncUser, syncUserDeletion,
  syncUserUdation, releaseSeatsAndDeleteBooking,
  sendBookingConfirmationEmail];