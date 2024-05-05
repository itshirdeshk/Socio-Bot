import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import userModel from "./src/models/user.js";
import eventModel from "./src/models/event.js";
import connectDb from "./src/config/db.js";

import { GoogleGenerativeAI } from "@google/generative-ai";

const bot = new Telegraf(process.env.BOT_TOKEN);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

try {
    connectDb();
    console.log("Database connected successfully!");
} catch (error) {
    console.log(error);
    process.kill(process.pid, "SIGTERM");
}

bot.start(async (ctx) => {
    const from = ctx.update.message.from;
    try {
        await userModel.findOneAndUpdate(
            { tgId: from.id },
            {
                firstName: from.first_name,
                lastName: from.last_name,
                isBot: from.is_bot,
                username: from.username,
            },
            {
                upsert: true,
                new: true,
            }
        );

        await ctx.reply(
            `Hey! ${from.first_name}, Welcome. I will be writing highly engaging social media posts for you 🚀 Just keep feeding me with the events throught the day. Let's shine on social media ✨`
        );
    } catch (error) {
        console.log(error);
        await ctx.reply("Facing Difficulties!");
    }
});

bot.command("generate", async (ctx) => {
    const from = ctx.update.message.from;

    const { message_id: waitingMessageId } = await ctx.reply(
        `Hey! ${from.first_name}, kindly wait for a moment. I am curating posts for you 🚀⏳`
    );

    const { message_id: waitingStickerId } = await ctx.replyWithSticker(
        "CAACAgEAAxkBAAMqZhvSl7OS5IBdapEsQwa147ST-2sAAsIDAAIivyhGENoKVYXX7Zs0BA"
    );

    const startOfTheDay = new Date();
    startOfTheDay.setHours(0, 0, 0, 0);

    const endOfTheDay = new Date();
    endOfTheDay.setHours(23, 59, 59, 999);

    // get events for the user
    const events = await eventModel.find({
        tgId: from.id,
        createdAt: {
            $gte: startOfTheDay,
            $lte: endOfTheDay,
        },
    });

    if (events.length === 0) {
        await ctx.deleteMessage(waitingMessageId);
        await ctx.deleteMessage(waitingStickerId);
        await ctx.reply("No events for the day.");
        return;
    }

    // console.log("Events: ", events);

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [
                        {
                            text: `Write like a human, for humans. Craft three engaging social media posts tailored for Linkedin, Facebook and Twitter audiences. Use simple language. Use given time lables just to understand the order of the event, don't mention the time in the posts. Each post should creatively highlight the following events. Ensure the tone is conversational and impactful. Focus on engaging the respective platform's audience, encouraging interaction, and driving interest in the events: ${events
                                .map((event) => event.text)
                                .join(", ")};
                            )}`,
                        },
                    ],
                },

                {
                    role: "model",
                    parts: [
                        {
                            text: "OKay! I will generate the posts when you write Generate.",
                        },
                    ],
                },
            ],
        });

        const msg = "Generate";

        const result = await chat.sendMessage(msg);
        const response = result.response;
        const text = response.text();

        // Store the tokens
        const history = await chat.getHistory();
        const msgContent = { role: "user", parts: [{ text: msg }] };
        const contents = [...history, msgContent];
        const { totalTokens } = await model.countTokens({ contents });

        await userModel.findOneAndUpdate(
            {
                tgId: from.id,
            },
            {
                $inc: {
                    totalTokens: totalTokens,
                },
            }
        );

        await ctx.deleteMessage(waitingMessageId);
        await ctx.deleteMessage(waitingStickerId);
        await ctx.reply(text);
    } catch (error) {
        console.log(error);
        await ctx.reply("Facing difficulties!");
    }
});

bot.help(async (ctx) => {
    await ctx.reply("For any help, contact - itshirdeshk@gmail.com");
});

bot.on(message("text"), async (ctx) => {
    const from = ctx.update.message.from;
    const message = ctx.update.message.text;

    try {
        await eventModel.create({
            text: message,
            tgId: from.id,
        });
        await ctx.reply(
            "Noted 👍, Keep texting me your thoughts. To generate the posts, just enter the command: /generate"
        );
    } catch (error) {
        console.log(error);
        await ctx.reply("Facing difficulties, please try again later.");
    }
});

bot.launch();

// Enable Graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
