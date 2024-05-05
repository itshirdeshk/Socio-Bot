import { mongoose } from "mongoose";

const eventSchema = mongoose.Schema(
    {
        text: {
            type: String,
            requried: true,
        },
        tgId: {
            type: String,
            required: true,
        },
    },
    { timestamps: true }
);

export default mongoose.model("Event", eventSchema);
