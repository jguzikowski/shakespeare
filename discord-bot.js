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
const AUTO_ROAST_CHANCE = 0.03; // 10% chance (0.01 = 1%, 0.05 = 5%, etc.)

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

// Get recent messages from the conversation for context
async function getRecentConversationContext(channel, targetMessageId, limit = 10) {
    try {
        // Fetch recent messages from the channel
        const messages = await channel.messages.fetch({ limit: 50 });
        
        // Find the target message
        const targetMessage = messages.get(targetMessageId);
        if (!targetMessage) return null;
        
        // Get messages that came before the target message (chronologically)
        const contextMessages = messages
            .filter(msg => 
                msg.createdTimestamp <= targetMessage.createdTimestamp && 
                !msg.author.bot
            )
            .sort((a, b) => a.createdTimestamp - b.createdTimestamp) // Chronological order
            .last(limit);
        
        // Format: "Username: message content"
        return contextMessages
            .map(msg => `${msg.author.username}: ${msg.content}`)
            .join('\n');
    } catch (error) {
        console.error("Error fetching conversation context:", error);
        return null;
    }
}

// Process text with AI (Shakespeare or Roast)
async function processText(text, mode = "shakespeare", username = null, conversationContext = null) {
    try {
        const payload = { text, mode };
        
        // Add username if provided (for roasts)
        if (username && mode === "roast") {
            payload.username = username;
        }
        
        // Add conversation context if provided
        if (conversationContext && mode === "roast") {
            payload.conversationContext = conversationContext;
        }
        
        const response = await fetch(CLOUDFLARE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
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

// Handle context menu interactions
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isContextMenuCommand()) return;

    const message = interaction.targetMessage;
    await interaction.deferReply();

    try {
        if (interaction.commandName === "Shakespeare the Message") {
            // Shakespeare mode
            const polishedText = await processText(message.content, "shakespeare");
            await interaction.editReply({
                content: `${message.author}, behold thy words transformed:\n\n**Original:**\n>>> ${message.content}\n\n**Shakespearean:**\n>>> ${polishedText}`,
            });
        } else if (interaction.commandName === "Roast this Message") {
            // Roast mode - get full conversation context
            const conversationContext = await getRecentConversationContext(
                message.channel,
                message.id,
                10  // Get last 10 messages in the conversation
            );
            
            const roast = await processText(
                message.content,
                "roast",
                message.author.username,
                conversationContext
            );
            
            await interaction.editReply({
                content: `${message.author}\n\n**Original:**\n>>> ${message.content}\n\n**The Roast:**\n>>> ${roast}`,
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
            // Get full conversation context
            const conversationContext = await getRecentConversationContext(
                message.channel,
                message.id,
                10  // Get last 10 messages in the conversation
            );
            
            // Generate the roast using the roast mode with username and context
            const roast = await processText(
                message.content,
                "roast",
                message.author.username,
                conversationContext
            );
            
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
