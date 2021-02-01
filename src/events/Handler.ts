/**
 * @file Handler
 * @description Handles and executes commands
 */

import type { Message, TextChannel, User } from "eris";
import { PrivateChannel } from "eris";
import { Event } from "../classes/Event";
import { inviteRegex } from "../helpers/constants";
import config from "../../config.json";
import * as Sentry from "@sentry/node";

export class HandlerEvent extends Event {
  events = ["messageCreate"];

  async run(_event: string, msg: Message<TextChannel>) {
    if (!msg || !msg.content || msg.author.bot || !msg.channel || !msg.author) return;
    let prefix = "";
    let localeString = "";

    // Finds what locale to use
    const guildconfig = await this.bot.db.getGuildConfig(msg.channel.guild ? msg.channel.guild.id : "");
    const userLocale = await this.bot.localeSystem.getUserLocale(msg.author.id, this.bot, true);
    if (userLocale) localeString = userLocale;
    else if (guildconfig?.locale && !userLocale) localeString = guildconfig.locale;
    const string = this.bot.localeSystem.getLocaleFunction(localeString);
    msg.string = string;

    // Tells people how to invite the bot if they send an invite
    if (msg.channel instanceof PrivateChannel && inviteRegex.test(msg.content)) {
      return msg.createEmbed(
        `📌 ${string("general.INVITE")}`,
        string("general.INVITE_INFO", {
          bot: `https://discord.com/oauth2/authorize?&client_id=${this.bot.user.id}&scope=bot&permissions=506850534`,
          support: "https://discord.gg/gZEj4sM",
        }),
      );
    }

    // Finds what prefix to use
    const mentionRegex = new RegExp(`<@!?${this.bot.user.id}> ?`);
    const mentionPrefix = mentionRegex.exec(msg.content);
    const prefixes = config.prefixes.map((p) => msg.content.toLowerCase().startsWith(p)).indexOf(true);
    if (mentionPrefix && mentionPrefix.index === 0) prefix = mentionPrefix[0];
    else if (guildconfig && guildconfig.prefix && msg.content.toLowerCase().startsWith(guildconfig.prefix)) prefix = guildconfig.prefix;
    else if ((!guildconfig || !guildconfig.prefix) && config.prefixes && prefixes !== -1) prefix = config.prefixes[prefixes];
    if (!prefix) return;
    msg.prefix = prefix;

    // Finds the command to run
    const [commandName, ...args] = msg.content.trim().slice(prefix.length).split(/ +/g);
    const command = this.bot.commands.find(
      (cmd) => cmd?.name === commandName.toLowerCase() || cmd?.aliases.includes(commandName.toLowerCase()),
    );

    if (!command) return;

    // Handles owner commands
    if (command.owner && !config.owners.includes(msg.author.id)) return;

    // Handles commands in DMs
    if (!command.allowdms && msg.channel instanceof PrivateChannel) {
      msg.createEmbed(string("global.ERROR"), string("global.ERROR_ALLOWDMS", { command: command.name }), "error");
      return;
    }

    // Handles disabled categories and commands
    if (command.allowdisable !== false) {
      // Disabled categories
      if (guildconfig?.disabledCategories?.includes(command.category)) {
        return msg.createEmbed(string("global.ERROR"), string("global.ERROR_DISABLEDCATEGORY", { command: command.name }), "error");
      }

      // Disabled commands
      if (guildconfig?.disabledCmds?.includes(command.name)) {
        return msg.createEmbed(string("global.ERROR"), string("global.ERROR_DISABLED", { command: command.name }), "error");
      }
    }

    // Handles NSFW commands
    if (command.nsfw && msg.channel.guild && !msg.channel.nsfw) {
      msg.createEmbed(string("global.ERROR"), string("global.ERROR_NSFW", { command: command.name }), "error");
      return;
    }

    // Checks to see if a member is staff
    const isStaff =
      msg.member?.permissions.has("administrator") || (guildconfig?.staffRole && msg.member?.roles.includes(guildconfig.staffRole));

    // Handles voice-only commands
    if (command.voice) {
      const uservoice = msg.channel.guild.members.get(msg.author.id)?.voiceState?.channelID;
      const botvoice = msg.channel.guild.members.get(this.bot.user.id)?.voiceState?.channelID;

      // If the user isn't in a voice channel or if the user isn't in the same channel as the bot
      if (!uservoice || (botvoice && uservoice !== botvoice)) {
        msg.createEmbed(string("global.ERROR"), string("global.ERROR_VOICE", { command: command.name }), "error");
        return;
      }

      // Checks to see if a member has specific roles
      const hasMusicRole = guildconfig?.musicRole && msg.member?.roles.includes(guildconfig.musicRole);

      // If the guild has musicRole set and the user doesn't have proper roles
      if (!hasMusicRole || (!hasMusicRole && !isStaff)) {
        return msg.createEmbed(string("global.ERROR"), string("global.ERROR_MUSICROLE"), "error");
      }

      // If the musicChannel is set and my brain is dying rn
      if (guildconfig?.musicChannel && uservoice !== guildconfig?.musicChannel) {
        msg.createEmbed(string("global.ERROR"), string("global.ERROR_MUSICCHANNEL"), "error");
        return;
      }

      // If onlyRQCC is set and the author isn't the same as the requester
      if (guildconfig?.onlyRequesterCanControl && this.bot.lavalink.manager.players.get(msg.channel.guild.id)) {
        const requester = this.bot.lavalink.manager.players.get(msg.channel.guild.id)?.queue?.current?.requester as User;

        if ((!isStaff || !hasMusicRole) && requester.id !== msg.author.id) {
          return msg.createEmbed(msg.string("global.ERROR"), msg.string("global.ERROR_MUSICREQUESTER"));
        }
      }
    }

    // Handles clientPerms, botPerms, requiredPerms, and staff commands
    if (msg.channel.guild) {
      const dmChannel = await msg.author.getDMChannel();
      const botPerms = msg.channel.guild.members.get(this.bot.user.id)?.permissions;

      // Handles agree channel commands
      if (command.name !== "agree") {
        if (guildconfig?.agreeChannel === msg.channel.id && guildconfig?.agreeBlockCommands !== false && !isStaff) {
          await msg.delete().catch(() => {});
          return;
        }
      }

      // Sends if the bot can't send messages in a channel or guild
      if (!msg.channel.permissionsOf(this.bot.user.id).has("sendMessages") || !botPerms?.has("sendMessages")) {
        return dmChannel.createMessage(string("global.ERROR_SENDPERMS", { channel: `<#${msg.channel.id}>` }));
      }

      // Sends if the bot can't embed messages in a channel or guild
      if (!msg.channel.permissionsOf(this.bot.user.id).has("embedLinks") || !botPerms.has("embedLinks")) {
        return dmChannel.createMessage(string("global.ERROR_EMBEDPERMS", { channel: `<#${msg.channel.id}>` }));
      }

      // Handles clientPerms
      if (command.clientperms?.length) {
        const missingPerms: string[] = [];
        command.clientperms.forEach((perm) => {
          if (!botPerms.has(perm)) missingPerms.push(perm);
        });

        // Sends any missingperms
        if (missingPerms.length) {
          return msg.createEmbed(
            string("global.ERROR"),
            string("global.ERROR_CLIENTPERMS", { perms: missingPerms.map((mperm) => `\`${mperm}\``).join(",") }),
            "error",
          );
        }
      }

      // Handles staff commands
      if (command.staff) {
        if (!msg.member?.permissions.has("administrator") && guildconfig?.staffRole && !msg.member?.roles.includes(guildconfig.staffRole)) {
          return msg.createEmbed(string("global.ERROR"), string("global.ERROR_STAFFCOMMAND"), "error");
        }
      }

      // Handles commands with requiredPerms
      if (command.requiredperms?.length && !guildconfig?.staffRole) {
        const missingPerms: string[] = [];
        command.requiredperms.forEach((perm) => {
          if (!msg.member?.permissions.has(perm)) missingPerms.push(perm);
        });

        // Sends any missingperms
        if (missingPerms.length) {
          return msg.createEmbed(
            string("global.ERROR"),
            string("global.ERROR_REQUIREDPERMS", { perms: missingPerms.map((mperm) => `\`${mperm}\``).join(",") }),
            "error",
          );
        }
      }
    }

    // Handles command cooldowns
    if (command.cooldown && !config.owners.includes(msg.author.id)) {
      const cooldown = this.bot.cooldowns.get(command.name + msg.author.id);
      if (cooldown) return msg.addReaction("⌛");
      this.bot.cooldowns.set(command.name + msg.author.id, new Date());
      setTimeout(() => {
        this.bot.cooldowns.delete(command.name + msg.author.id);
      }, command.cooldown);
    }

    // Handles command arguments
    let parsedArgs: ParsedArgs[];
    if (command.args) {
      // Parses arguments and sends if missing any
      parsedArgs = this.bot.args.parse(command.args, args.join(" "), msg);
      const missingargs = parsedArgs.filter((a) => typeof a.value == "undefined" && !a.optional);

      if (missingargs.length) {
        return msg.createEmbed(
          string("global.ERROR"),
          string("global.ERROR_MISSINGARGS", { arg: `${missingargs.map((a) => a.name).join(` ${string("global.OR")} `)}` }),
          "error",
        );
      }
    }

    // Logs when a command is ran
    this.bot.log.info(`${msg.tagUser(msg.author)} ran ${command.name} in ${msg.channel.guild?.name}${args.length ? `: ${args}` : ""}`);
    this.bot.logs.push({
      cmdName: command.name,
      authorID: msg.author.id,
      guildID: msg.channel.guild ? msg.channel.guild.id : msg.author.id,
      args: args,
      date: msg.timestamp,
    });

    try {
      // Runs the command
      await command.run(msg, parsedArgs, args);
    } catch (err) {
      // Captures exceptions with Sentry
      Sentry.configureScope((scope) => {
        scope.setUser({ id: msg.author.id, username: msg.tagUser(msg.author) });
        scope.setExtra("guild", msg.channel.guild?.name);
        scope.setExtra("guildID", msg.channel.guild?.id);
      });

      // Logs the error
      Sentry.captureException(err);
      console.error(err);
      return msg.createEmbed(string("global.ERROR"), string("global.ERROR_OUTPUT", { error: err }), "error");
    }
  }
}
