import { mongoose } from "mongoose";

export default() => {
    return mongoose.connect(process.env.MONGODB_CONNECT_STRING);
}