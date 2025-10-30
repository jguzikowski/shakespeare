// Discord Bot - Message Polisher with Roasting
// This bot integrates with your Cloudflare Function to polish messages
const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    ContextMenuCommandBuilder,
    ApplicationCommandType,
} = require("discord.js");

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Your bot token
const CLIENT_ID = process.env.CLIENT_ID; // Your bot's application ID
const CLOUDFLARE_API_URL = "https://shakestranslator.pages.dev/api/polish"; // Your Cloudflare function URL
const AUTO_ROAST_CHANCE = 0.10; // 1% chance (0.01 = 1%, 0.05 = 5%, etc.)

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Register commands
async function registerCommands() {
    const commands = [
        // Shakespeare context menu
        new ContextMenuCommandBuilder()
            .setName("Shakespeare the Message")
            .setType(ApplicationCommandType.Message),
        // Roast context menu
        new ContextMenuCommandBuilder()
            .setName("Roast this Message")
            .setType(ApplicationCommandType.Message),
    ];

    const rest = new REST({ version: "10" }).setToken(DISCORD_TOKEN);

    try {
        console.log("Registering commands...");
        await rest.put(Routes.applicationCommands(CLIENT_ID), {
            body: commands,
        });
        console.log("Commands registered successfully!");
    } catch (error) {
        console.error("Error registering commands:", error);
    }
}

// Process text with AI (Shakespeare or Roast)
async function processText(text, mode = "shakespeare") {
    try {
        const response = await fetch(CLOUDFLARE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text, mode }), // Pass mode to API
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.polished;
    } catch (error) {
        console.error("Error processing text:", error);
        throw error;
    }
}

// Generate a roast using AI
async function generateRoast(text) {
    // For now, we'll use a simple prompt modification
    // You can create a separate Cloudflare function endpoint for roasts later
    const roastPrompt = `Roast this terrible message with maximum sass and humor, but keep it friendly: "${text}"`;
    
    try {
        const response = await fetch(CLOUDFLARE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: roastPrompt }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.polished;
    } catch (error) {
        console.error("Error generating roast:", error);
        throw error;
    }
}

// Handle context menu interactions
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isContextMenuCommand()) return;

    const message = interaction.targetMessage;
    await interaction.deferReply();

    try {
        if (interaction.commandName === "Shakespeare the Message") {
            // Shakespeare mode
            const polishedText = await processText(message.content);
            await interaction.editReply({
                content: `${message.author}, behold thy words transformed:\n\n**Original:**\n>>> ${message.content}\n\n**Shakespearean:**\n>>> ${polishedText}`,
            });
        } else if (interaction.commandName === "Roast this Message") {
            // Roast mode
            const roast = await generateRoast(message.content);
            await interaction.editReply({
                content: `${message.author} 🔥 **ROASTED** 🔥\n\n**Original message:**\n>>> ${message.content}\n\n**The Roast:**\n>>> ${roast}`,
            });
        }
    } catch (error) {
        await interaction.editReply({
            content: "❌ Sorry, something went wrong. Please try again.",
        });
    }
});

// Auto-roast random messages
client.on("messageCreate", async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Ignore empty messages
    if (!message.content || message.content.trim().length === 0) return;
    
    // Roll the dice - random chance to roast
    if (Math.random() < AUTO_ROAST_CHANCE) {
        console.log(`🎲 Auto-roasting ${message.author.username}'s message!`);
        
        try {
            // Generate the roast
            const roast = await generateRoast(message.content);
            
            // Reply to the message with the roast
            await message.reply({
                content: `🎲 **RANDOM ROAST ACTIVATED** 🔥\n\n${message.author}, the roast gods have chosen you!\n\n**Your message:**\n>>> ${message.content}\n\n**The Roast:**\n>>> ${roast}`,
            });
        } catch (error) {
            console.error("Error auto-roasting:", error);
            // Fail silently - don't spam the chat with errors
        }
    }
});

// Bot ready event
client.once("ready", () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`🎲 Auto-roast chance: ${AUTO_ROAST_CHANCE * 100}%`);
    registerCommands();
});

// Login to Discord
client.login(DISCORD_TOKEN);
