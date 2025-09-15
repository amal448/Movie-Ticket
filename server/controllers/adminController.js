//api to check if user is admin

import Booking from "../models/Booking.js"
import Show from "../models/Shows.js"
import User from "../models/User.js"

export const isAdmin = async (req, res) => {
    res.json({ success: true, isAdmin: true })
}

//Api to get dashboard data
export const getDashboardData = async (req, res) => {
    try {
        const bookings = await Booking.find({ isPaid: true })
        const activeShows = await Show.find({ showDateTime: { $gte: new Date() } })
        .populate('movie')
        console.log("activeShows", activeShows);

        const totalUser = await User.countDocuments();
        const dashboardData = {
            totalBookings: bookings.length,
            totalRevenue: bookings.reduce((acc, booking) => acc + booking.amount, 0),
            activeShows,
            totalUser
        }
        res.json({ success: true, dashboardData })
    }
    catch (error) {
        res.json({ success: false, message: error.message })
    }
}

//Api to get all shows
export const getAllShows = async (req, res) => {
    try {
        const shows = await Show.find({ showDateTime: { $gte: new Date() } })
            .populate('movie').sort({ showDateTime: 1 })
        res.json({ success: true, shows })
    }
    catch (error) {
        res.json({ success: false, message: error.message })
    }

}

//Api to get all booking data
export const getAllBooking = async (req, res) => {
    try {
        const bookings = await Booking.find({}).populate('user').populate({
            path: "show",
            populate: { path: "movie" }
        }).sort({ createdAt: -1 })
        res.json({ success: true, bookings })

    }
    catch (error) {
        res.json({ success: false, message: error.message })
    }

}