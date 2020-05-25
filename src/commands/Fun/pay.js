const Command = require("../../lib/structures/Command");

class payCommand extends Command {
  constructor(...args) {
    super(...args, {
      aliases: ["give", "givecookie", "givecookies"],
      args: "<member:member> <amount:string>",
      description: "Gives a member some cookies.",
    });
  }

  async run(msg, args, pargs) {
    const user = pargs[0].value;
    const amount = parseInt(args[1]);
    // Blocks bots, selfpaying; non-integers
    if (user.bot) return msg.channel.createMessage(this.bot.embed("❌ Error", "You can't give cookies to a bot.", "error"));
    if (user.id === msg.author.id) return msg.channel.createMessage(this.bot.embed("❌ Error", "Fraud is illegal.", "error"));
    if (!amount || isNaN(amount)) return msg.channel.createMessage(this.bot.embed("❌ Error", "You provided an invalid amount of cookies.", "error"));

    // Gets author & user's cookies
    let ucookies = await this.bot.db.table("economy").get(user.id);
    let acookies = await this.bot.db.table("economy").get(msg.author.id);

    // If no cookies
    if (!ucookies) {
      await this.bot.db.table("economy").insert({
        id: user.id,
        amount: 0,
        lastclaim: 9999,
      });
      return ucookies = await this.bot.db.table("economy").get(user.id);
    }

    // If no cookies
    if (!acookies) {
      await this.bot.db.table("economy").insert({
        id: user.id,
        amount: 0,
        lastclaim: 9999,
      });
      return acookies = await this.bot.db.table("economy").get(msg.author.id);
    }

    // Compares cookie amounts
    if (amount > acookies.amount || acookies.amount <= 0) return msg.channel.createMessage(this.bot.embed("❌ Error", "You don't have enough cookies.", "error"));
    acookies.amount -= amount;
    ucookies.amount += amount;
    // Updates cookie amounts
    await this.bot.db.table("economy").get(user.id).update(ucookies);
    await this.bot.db.table("economy").get(msg.author.id).update(acookies);
    msg.channel.createMessage(this.bot.embed("🍪 Pay", `You gave **${amount}** cookie${amount === 1 ? "" : "s"} to **${user.username}**.`));
  }
}

module.exports = payCommand;
