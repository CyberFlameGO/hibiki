const Command = require("../../lib/structures/Command");

class iconCommand extends Command {
  constructor(...args) {
    super(...args, {
      aliases: ["guildicon", "servericon"],
      description: "Sends the server's icon.",
    });
  }

  run(msg, args) {
    // Gets the guild
    let guild = msg.channel.guild;
    // Lets owners show other server icons
    if (args[0] && this.bot.cfg.owners.includes(msg.author.id)) {
      guild = this.bot.guilds.find(g => g.name.toLowerCase().startsWith(args.join(" ")) || g.id === args.join(" "));
    } else guild = msg.channel.guild;
    if (!guild) return msg.channel.guild;
    // If no icon
    if (!guild.iconURL) return msg.channel.createMessage(this.bot.embed("❌ Error", "This server doesn't have an icon set.", "error"));

    // Sends the embed
    msg.channel.createMessage({
      embed: {
        color: this.bot.embed.color("general"),
        author: {
          icon_url: guild.iconURL || "https://cdn.discordapp.com/embed/avatars/0.png",
          name: guild.name,
        },
        image: {
          url: guild.iconURL,
        },
      },
    });
  }
}

module.exports = iconCommand;