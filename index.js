require("dotenv").config();
const fs = require("fs");
const config = require("./config");
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

/* ================== DATA ================== */
function loadTickets() {
  if (!fs.existsSync("./tickets.json")) {
    fs.writeFileSync("./tickets.json", JSON.stringify({ tickets: {} }, null, 2));
  }
  return JSON.parse(fs.readFileSync("./tickets.json"));
}

function saveTickets(data) {
  fs.writeFileSync("./tickets.json", JSON.stringify(data, null, 2));
}

/* ================== EMBED ================== */
function ticketEmbed(title, desc) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(config.EMBED.COLOR)
    .setFooter({ text: config.EMBED.FOOTER })
    .setTimestamp();
}

/* ================== READY ================== */
client.once("ready", () => {
  console.log(`🎫 Ticket Bot Online: ${client.user.tag}`);
});

/* ================== SEND PANEL ================== */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
    return;

  if (message.content === "!ticket") {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("open_ticket")
        .setLabel("📩 Mở Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await message.channel.send({
      embeds: [
        ticketEmbed(
          "🎫 HỖ TRỢ – TICKET",
          "Nhấn nút bên dưới để mở ticket hỗ trợ.\nStaff sẽ phản hồi sớm nhất."
        )
      ],
      components: [row]
    });
  }
});

/* ================== BUTTON ================== */
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  /* ===== OPEN TICKET ===== */
  if (interaction.customId === "open_ticket") {
    const data = loadTickets();
    if (data.tickets[interaction.user.id]) {
      return interaction.reply({
        embeds: [
          ticketEmbed(
            "❌ ĐÃ CÓ TICKET",
            "Bạn đã có ticket đang mở rồi."
          )
        ],
        ephemeral: true
      });
    }

    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: config.TICKET_CATEGORY_ID,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ]
        },
        ...config.STAFF_ROLE_IDS.map((id) => ({
          id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages
          ]
        }))
      ]
    });

    data.tickets[interaction.user.id] = channel.id;
    saveTickets(data);

    await channel.send({
      content: `<@${interaction.user.id}>`,
      embeds: [
        ticketEmbed(
          "🎫 TICKET ĐÃ MỞ",
          "Vui lòng mô tả vấn đề của bạn.\nStaff sẽ hỗ trợ sớm."
        )
      ],
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close_ticket")
            .setLabel("🔒 Đóng Ticket")
            .setStyle(ButtonStyle.Secondary)
        )
      ]
    });

    await interaction.reply({
      embeds: [
        ticketEmbed(
          "✅ TICKET ĐÃ TẠO",
          `Ticket của bạn: <#${channel.id}>`
        )
      ],
      ephemeral: true
    });
  }

  /* ===== CLOSE TICKET ===== */
  if (interaction.customId === "close_ticket") {
    const data = loadTickets();
    const ownerId = Object.keys(data.tickets).find(
      (k) => data.tickets[k] === interaction.channel.id
    );

    if (ownerId) {
      delete data.tickets[ownerId];
      saveTickets(data);
    }

    await interaction.reply({
      embeds: [
        ticketEmbed("🔒 ĐÓNG TICKET", "Ticket sẽ bị xóa sau 5 giây.")
      ]
    });

    setTimeout(async () => {
      await interaction.channel.delete().catch(() => {});
    }, 5000);

    const logChannel = await interaction.guild.channels
      .fetch(config.LOG_CHANNEL_ID)
      .catch(() => null);

    if (logChannel) {
      logChannel.send({
        embeds: [
          ticketEmbed(
            "📄 LOG TICKET",
            `Ticket **${interaction.channel.name}** đã bị đóng bởi <@${interaction.user.id}>`
          )
        ]
      });
    }
  }
});

/* ================== LOGIN ================== */
client.login(process.env.TOKEN);

