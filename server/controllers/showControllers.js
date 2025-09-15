import axios from "axios";
import Movie from "../models/Movie.js";
import Show from "../models/Shows.js";

export const getNowPlayingMovies = async (req, res) => {
    try {
        const { data } = await axios.get('https://api.themoviedb.org/3/movie/now_playing', {
            headers: { Authorization: `Bearer ${process.env.API_Read_Access_Token}` }
        })
        // console.log("data", data);

        const movies = data.results;
        res.json({ success: true, movies: movies })
    }
    catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })

    }
}
//Api to add a new show to the database

export const addShow = async (req, res) => {
    try {
        const { movieId, showInput, showPrice } = req.body
        let movie = await Movie.findById(movieId)
        if (!movie) {
            // Fetch movie details and credits from tmdb
            const [movieDetailsResponse, movieCreditsResponse] = await Promise.all([
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
                    headers: { Authorization: `Bearer ${process.env.API_Read_Access_Token}` }
                }),
                axios.get(`https://api.themoviedb.org/3/movie/${movieId}/credits`, {
                    headers: { Authorization: `Bearer ${process.env.API_Read_Access_Token}` }
                })
            ]);

            const movieApiData = movieDetailsResponse.data
            const movieCreditsData = movieCreditsResponse.data

            const movieDetails = {
                _id: movieId,
                title: movieApiData.title,
                overview: movieApiData.overview,
                poster_path: movieApiData.poster_path,
                backdrop_path: movieApiData.backdrop_path,
                genres: movieApiData.genres,
                casts: movieCreditsData.cast,
                release_date: movieApiData.release_date,
                original_language: movieApiData.original_language,
                tagline: movieApiData.tagline || "",
                vote_average: movieApiData.vote_average,
                runtime: movieApiData.runtime
            }
            //Add movie to the db
            movie = await Movie.create(movieDetails)
        }
        const showToCreate = [];
        console.log("showInput",showInput);
        
        showInput.forEach(show => {
            const showDate = show.date;
            
            show.time.forEach((time) => {
                const dateTimeString = `${showDate}T${time}`;
                showToCreate.push({
                    movie: movieId,
                    showDateTime: new Date(dateTimeString),
                    showPrice,
                    occupiedSeats: {}
                })
            })
        });
        if (showToCreate.length > 0) {
            console.log("showToCreate",showToCreate);
            
            await Show.insertMany(showToCreate)
        }
        res.json({ success: true, message: "Show Added successfully" })

    }
    catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })

    }
}

export const getShows = async (req, res) => {
    try {
        const shows = await Show.find({ showDateTime: { $gte: new Date() } })
            .populate('movie').sort({ showDateTime: 1 })
        // console.log(shows);

        //filter unique shows
        const uniqueShows = new Set(shows.map(show => show.movie))
        console.log("uniqueShows",uniqueShows);
        
        res.json({ success: true, shows: Array.from(uniqueShows) })

    }
    catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })
    }
}
export const getShow = async (req, res) => {
    try {
        const { movieId } = req.params
        const shows=await Show.find({movie:movieId,showDateTime:{$gte:new Date()}})
        const movie=await Movie.findById(movieId)
        const dateTime={}

        shows.forEach((show)=>{
            const date=show.showDateTime.toISOString().split("T")[0];
            if(!dateTime[date])
            {
                dateTime[date]=[]
            }
            console.log("dateTimebefore",dateTime);

            dateTime[date].push({time:show.showDateTime,showId:show._id})
            console.log("dateTimeafter",dateTime);

        })
        res.json({success:true,movie,dateTime})
    }
     catch (error) {
        console.log(error);
        res.json({ success: false, message: error.message })

    }
}