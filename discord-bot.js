// Discord Bot - Message Polisher
// This bot integrates with your Cloudflare Function to polish messages

const { Client, GatewayIntentBits, REST, Routes, ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Your bot token
const CLIENT_ID = process.env.CLIENT_ID; // Your bot's application ID
const CLOUDFLARE_API_URL = 'https://shakestranslator.pages.dev/api/polish'; // Your Cloudflare function URL

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// Register slash command and context menu
async function registerCommands() {
    const commands = [
        // Context menu command (right-click message)
        new ContextMenuCommandBuilder()
            .setName('Polish Message')
            .setType(ApplicationCommandType.Message),
    ];

    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

    try {
        console.log('Registering commands...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('Commands registered successfully!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

// Polish text using Cloudflare function
async function polishText(text) {
    try {
        const response = await fetch(CLOUDFLARE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        return data.polished;
    } catch (error) {
        console.error('Error polishing text:', error);
        throw error;
    }
}

// Handle interactions (context menu, slash commands)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isContextMenuCommand()) return;

    if (interaction.commandName === 'Polish Message') {
        // Get the message that was right-clicked
        const message = interaction.targetMessage;

        // Defer reply (polishing might take a few seconds)
        await interaction.deferReply();

        try {
            // Polish the message
            const polishedText = await polishText(message.content);

            // Send the polished version
            await interaction.editReply({
                content: `**Original message from ${message.author.username}:**\n>>> ${message.content}\n\n**Polished version:**\n>>> ${polishedText}`,
            });
        } catch (error) {
            await interaction.editReply({
                content: '❌ Sorry, something went wrong while polishing the message. Please try again.',
            });
        }
    }
});

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    registerCommands();
});

// Login to Discord
client.login(DISCORD_TOKEN);
