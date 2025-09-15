import express from 'express'
import { protectAdmin } from '../middleware/auth.js';
import { isAdmin } from '../controllers/adminController.js';
import { getDashboardData,getAllShows,getAllBooking } from '../controllers/adminController.js';

const adminRouter=express.Router()

adminRouter.get('/is-Admin',protectAdmin,isAdmin);
adminRouter.get('/dashboard',protectAdmin,getDashboardData);
adminRouter.get('/all-shows',protectAdmin,getAllShows);
adminRouter.get('/all-bookings',protectAdmin,getAllBooking);

export default adminRouter;
