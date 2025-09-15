import mongoose from "mongoose";

async function ConnectDb()
{
    try{
        await  mongoose.connect(`${process.env.MONGOURL}/quickshow`,{
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
        console.log("Database connected Successfully");
        
    }
    catch(error)
    {
              console.log("Database connected Failed",error.message);
    }
}
export default ConnectDb