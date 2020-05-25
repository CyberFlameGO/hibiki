const Command = require("../../lib/structures/Command");
const fetch = require("node-fetch");

class lewdCommand extends Command {
  constructor(...args) {
    super(...args, {
      args: "<member:member&fallback>",
      description: "Tells a member they're being too lewd.",
      cooldown: 3,
    });
  }

  async run(msg, args, pargs) {
    const body = await fetch("https://api.weeb.sh/images/random?type=lewd", { headers: { "Authorization": `Wolke ${this.bot.key.weebsh}`, "User-Agent": `${this.bot.user.username}/${this.bot.version}` } })
      .then(async res => await res.json().catch(() => {}));
    let image;

    // Fallback image
    if (body.status !== 200) image = "https://cdn.weeb.sh/images/H1Fv6p_DW.gif";
    else if (body.status === 200) image = body.url;

    msg.channel.createMessage({
      embed: {
        description: `🔞 **${pargs[0].value.username}** is being too lewd!`,
        color: this.bot.embed.color("general"),
        image: {
          url: image,
        },
        footer: {
          icon_url: this.bot.user.dynamicAvatarURL(),
          text: "Powered by weeb.sh",
        },
      },
    });
  }
}

module.exports = lewdCommand;
