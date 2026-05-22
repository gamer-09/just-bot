const {
  Client, GatewayIntentBits, EmbedBuilder,
  REST, Routes, SlashCommandBuilder,
  ChannelType, PermissionFlagsBits,
} = require("discord.js");
const fs   = require("fs");
const path = require("path");
const http = require("http");
require("dotenv").config();

// ─── Health Check Server ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Isekai Chronicles — The realm endures.\n");
});
server.listen(PORT, () => console.log(`Health ward bound to port ${PORT}`));
process.on("SIGTERM", () => { client.destroy(); server.close(() => process.exit(0)); });
process.on("SIGINT",  () => { client.destroy(); server.close(() => process.exit(0)); });

// ─── Data Layer ───────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "world.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch {}
  return {
    users: {}, factions: {},
    world:  { lore: [], currentEvent: null, lastEventDate: null, warHistory: [] },
    config: { leaderboardChannelId: null, lastLeaderboard: [] },
  };
}
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
let db = loadData();
if (!db.config) db.config = { leaderboardChannelId: null, lastLeaderboard: [] };

// ─── Definitions ──────────────────────────────────────────────────────────────
const RACES = {
  demon:        { name: "Demon",        color: "#8B0000", emoji: "👿", hp: 120, atk: 25, def: 15, int: 20, spd: 10, lore: "Born from the abyss itself, their hunger for dominion knows no boundary." },
  fallen_angel: { name: "Fallen Angel", color: "#4B0082", emoji: "🪽", hp: 90,  atk: 10, def: 10, int: 40, spd: 25, lore: "Cast from celestial grace, their fall carved hollows into their very souls." },
  cursed_human: { name: "Cursed Human", color: "#2F4F4F", emoji: "💀", hp: 110, atk: 20, def: 20, int: 20, spd: 20, lore: "Ancient dark scripture was etched into their blood — they walk between worlds uninvited." },
  vampire:      { name: "Vampire",      color: "#800020", emoji: "🧛", hp: 115, atk: 30, def: 10, int: 15, spd: 30, lore: "Immortal predators who drink life to outrun the oblivion that pursues them." },
  witch:        { name: "Witch",        color: "#483D8B", emoji: "🧙", hp: 80,  atk: 10, def: 10, int: 50, spd: 15, lore: "Weavers of forbidden scripture — they do not bend to the laws of reality; they rewrite them." },
};

const CLASSES = {
  assassin:    { name: "Assassin",    emoji: "🗡️",  atk: 20, def: 0,  int: 0,  spd: 20, hp: -10, crit: 0.25, lore: "The shadow moves. The blade sings. The foe is already dead." },
  mage:        { name: "Mage",        emoji: "🔮",  atk: 0,  def: 0,  int: 25, spd: 5,  hp: -10, crit: 0.10, lore: "Arcane fire pours through their veins like a river of ancient ruin." },
  knight:      { name: "Knight",      emoji: "🛡️",  atk: 10, def: 25, int: 0,  spd: -5, hp: 30,  crit: 0.05, lore: "Immovable as a cursed mountain — the last wall between the living and oblivion." },
  oracle:      { name: "Oracle",      emoji: "👁️",  atk: 0,  def: 5,  int: 20, spd: 15, hp: 0,   crit: 0.15, lore: "They whisper with dead tongues and see the wound before the blade is drawn." },
  necromancer: { name: "Necromancer", emoji: "☠️",  atk: 15, def: 0,  int: 20, spd: 0,  hp: 0,   crit: 0.10, lore: "Death answers to them. They merely decide how many rise." },
};

const QUEST_POOL = [
  { id: "shadow_catacombs", name: "The Shadow Catacombs",        desc: "Descend into a tomb where the restless dead do not sleep, nor do they forgive trespassers.",          difficulty: "easy",      xp: 50,  coins: 30,  durationMs: 3*60*1000,  deathChance: 0    },
  { id: "cursed_forest",    name: "The Ever-Weeping Forest",      desc: "A forest where time bleeds backward and the trees have learned to scream. Tread with purpose.",       difficulty: "easy",      xp: 60,  coins: 40,  durationMs: 3*60*1000,  deathChance: 0    },
  { id: "void_fragment",    name: "The Void Fragment",            desc: "A shard of crystallised emptiness rests in the wasteland. Retrieve it. Do not look into it.",         difficulty: "medium",    xp: 120, coins: 80,  durationMs: 5*60*1000,  deathChance: 0.05 },
  { id: "blood_moon_hunt",  name: "The Blood Moon Hunt",          desc: "When the moon bleeds, unspeakable things emerge. You have been asked to push them back.",             difficulty: "medium",    xp: 140, coins: 90,  durationMs: 5*60*1000,  deathChance: 0.08 },
  { id: "demon_lord_trial", name: "The Demon Lord's Trial",       desc: "An audience with the Demon Lord himself — an honour indistinguishable from a sentence.",              difficulty: "hard",      xp: 250, coins: 150, durationMs: 10*60*1000, deathChance: 0.15 },
  { id: "arcane_vault",     name: "The Sealed Arcane Vault",      desc: "Forbidden knowledge is locked away for a reason. You intend to read every word of it.",               difficulty: "hard",      xp: 280, coins: 170, durationMs: 10*60*1000, deathChance: 0.20 },
  { id: "abyss_descent",    name: "Descent into the Abyss",       desc: "The deepest layer of the underworld has no name — only those who return may give it one.",            difficulty: "legendary", xp: 500, coins: 300, durationMs: 15*60*1000, deathChance: 0.30 },
  { id: "world_rift",       name: "The World Rift Expedition",    desc: "A tear in existence leads somewhere no map has ever charted. You are the cartographer now.",          difficulty: "legendary", xp: 600, coins: 350, durationMs: 15*60*1000, deathChance: 0.35 },
];

const WORLD_EVENTS = [
  { name: "🐉 The Dragon's Descent",     desc: "A dragon older than the realm's first king blackens the sky. Those who stand against it shall be remembered. Battle rewards are doubled.",    effect: "pvp_bonus"     },
  { name: "🌀 The Veil Tears Open",       desc: "A wound in reality yawns wide above the citadel. Strange light pours through. Quest rewards are doubled until the veil seals.",              effect: "quest_bonus"   },
  { name: "⛈️ The Eternal Cursed Storm",  desc: "A storm of ancient wrath sweeps the realm. All living souls lose 10 HP. Witches, old as the storm itself, are spared.",                    effect: "hp_drain"      },
  { name: "🌕 The Blood Moon Rises",      desc: "The moon weeps crimson. Vampires feel the old hunger surge. Assassins walk between heartbeats. Both are... elevated.",                       effect: "vampire_boost" },
  { name: "✨ The Great Arcane Surge",    desc: "The ley lines of the world tremble and overflow. Mages, Witches, and Oracles feel boundless power thrumming in their palms.",               effect: "magic_boost"   },
  { name: "☣️ The Dark Plague",           desc: "An ancient sickness — older than the first king — creeps through the realm. The weak shall suffer most. The strong endure.",               effect: "plague"        },
  { name: "⚔️ The Grand Dark Tournament", desc: "The Void Court calls for blood sport. A tournament is declared across the realm. All combat rewards are doubled.",                          effect: "tournament"    },
  { name: "🏚️ The Tomb Beneath the Ruin", desc: "Scholars have found a tomb beneath the old ruin — older than any recorded dynasty. Quest loot is doubled as the tomb is pillaged.",         effect: "quest_bonus"   },
  { name: "🖤 The Dark Miracle",          desc: "Something stirs beneath the realm's foundations. A deity — name long forgotten — exhales. All living souls are fully restored.",            effect: "heal_all"      },
  { name: "🕳️ The Void Rift Yawns",      desc: "A rift breathes open in the sky. Reality shudders. The next legendary quest begun this day carries an ancient blessing.",                  effect: "void_rift"     },
];

const SHOP_ITEMS = [
  { id: "health_potion",       name: "Vial of Restored Life",     price: 50,  desc: "A bitter draught that restores 30 HP — the taste of survival.",           type: "consumable", hpRestore: 30    },
  { id: "greater_potion",      name: "Elixir of the Undying",     price: 120, desc: "Full restoration. Said to taste like old blood and starlight.",            type: "consumable", hpRestore: 99999 },
  { id: "void_shard",          name: "Void Shard",                price: 200, desc: "A sliver of crystallised darkness. Permanently grants +15 ATK.",           type: "permanent",  statBoost: { atk: 15 } },
  { id: "shadow_cloak",        name: "Cloak of the Shadowless",   price: 180, desc: "Woven from the absence of light. Permanently grants +20 SPD.",             type: "permanent",  statBoost: { spd: 20 } },
  { id: "arcane_tome",         name: "The Forbidden Tome",        price: 220, desc: "Pages that burn the eyes of the unworthy. Permanently grants +20 INT.",    type: "permanent",  statBoost: { int: 20 } },
  { id: "iron_fortress",       name: "Bastion of the Damned",     price: 190, desc: "Armour forged in the first war. Permanently grants +20 DEF.",              type: "permanent",  statBoost: { def: 20 } },
  { id: "dark_elixir",         name: "Ichor of the Ancient Dead", price: 300, desc: "Drink deep and grow. Permanently grants +10 to ALL stats.",                type: "permanent",  statBoost: { atk: 10, def: 10, int: 10, spd: 10 } },
  { id: "resurrection_stone",  name: "The Resurrection Stone",    price: 500, desc: "A pale stone warm to the touch. Instantly returns you from death.",        type: "special"  },
  { id: "betrayal_dagger",     name: "The Betrayer's Dagger",     price: 350, desc: "Switch factions in secret. Treachery earns +150 🔷 bonus on use.",         type: "special"  },
];

// ─── Achievements ─────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id: "first_breath",   name: "First Breath in the Dark World",   emoji: "🌌", desc: "Thou hast crossed the veil and entered this realm. The chronicle begins.",              check: c => c.questsCompleted >= 0 },
  { id: "seeker",         name: "Seeker of the Dark Path",          emoji: "📜", desc: "Thy first quest is complete. The realm has taken notice of thee.",                     check: c => c.questsCompleted >= 1 },
  { id: "veteran",        name: "Veteran of the Void",              emoji: "⚔️", desc: "Ten quests survived. The abyss has come to know thy name.",                           check: c => c.questsCompleted >= 10 },
  { id: "awakened",       name: "The Awakened",                     emoji: "✨", desc: "Level 5 — power stirs in thy blood. The realm trembles slightly.",                    check: c => c.level >= 5 },
  { id: "ascendant",      name: "The Ascendant",                    emoji: "🔥", desc: "Level 10 — ancient forces bow their heads at thy approach.",                          check: c => c.level >= 10 },
  { id: "ancient_power",  name: "Ancient Power",                    emoji: "👑", desc: "Level 25 — thou art older than most kingdoms. The dark reveres thee.",               check: c => c.level >= 25 },
  { id: "first_blood",    name: "First Blood",                      emoji: "🩸", desc: "Thy blade has claimed its first victory. The taste of combat suits thee.",            check: c => c.battlesWon >= 1 },
  { id: "war_scarred",    name: "War-Scarred",                      emoji: "🛡️", desc: "Ten victories in battle. The scars upon thee are a map of thy history.",             check: c => c.battlesWon >= 10 },
  { id: "reaper",         name: "The Reaper",                       emoji: "💀", desc: "Thou hast claimed a soul. Death has accepted thee as a colleague.",                   check: c => c.killCount >= 1 },
  { id: "death_touched",  name: "Death-Touched",                    emoji: "👻", desc: "Thou hast died and returned. The void remembers thy face.",                           check: c => c.deaths >= 1 },
  { id: "lord_shadows",   name: "Lord of Shadows",                  emoji: "🏰", desc: "A faction rises at thy command. The dark court acknowledges thine ambition.",         check: c => !!c.faction },
  { id: "warlord",        name: "The Warlord",                      emoji: "⚔️", desc: "Fifty victories. Generals speak thy name before battle as a prayer.",                check: c => c.battlesWon >= 50 },
  { id: "crystal_hoard",  name: "The Crystal Hoarder",              emoji: "💎", desc: "One thousand Void Crystals in thy possession. Wealth is power in this realm.",       check: c => c.coins >= 1000 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createCharacter(userId, name, raceKey, classKey) {
  const race = RACES[raceKey], cls = CLASSES[classKey];
  const maxHp = race.hp + cls.hp;
  return {
    userId, name, race: raceKey, class: classKey,
    level: 1, xp: 0, xpToNext: 100,
    hp: maxHp, maxHp,
    atk: race.atk + cls.atk, def: race.def + cls.def,
    int: race.int + cls.int, spd: race.spd + cls.spd, crit: cls.crit,
    coins: 100, status: "alive",
    faction: null, inventory: [], achievements: ["first_breath"],
    currentQuest: null,
    questsCompleted: 0, battlesWon: 0, battlesLost: 0, killCount: 0, deaths: 0,
    lastActive: Date.now(), createdAt: Date.now(), lastDaily: 0, title: null,
  };
}

function giveXP(char, amount) {
  char.xp += amount;
  let leveled = false;
  while (char.xp >= char.xpToNext) {
    char.xp -= char.xpToNext;
    char.level++;
    char.xpToNext = Math.floor(100 * Math.pow(1.3, char.level - 1));
    char.maxHp += 5; char.hp = Math.min(char.hp + 5, char.maxHp);
    char.atk += 2; char.def += 1; char.int += 2; char.spd += 1;
    leveled = true;
  }
  return leveled;
}

function hpBar(hp, max, len = 10) {
  const f = Math.max(0, Math.round((hp / max) * len));
  return "█".repeat(f) + "░".repeat(len - f);
}
function xpBar(xp, next, len = 10) {
  const f = Math.max(0, Math.round((xp / next) * len));
  return "▓".repeat(f) + "░".repeat(len - f);
}
function powerScore(c) {
  return c.atk * 2 + c.def + c.int * 1.5 + c.spd + c.level * 10;
}
function diffColor(d) {
  return { easy: "#57F287", medium: "#FEE75C", hard: "#ED4245", legendary: "#8B0000" }[d] ?? "#ffffff";
}
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function simulateCombat(a, d) {
  let aHp = a.hp, dHp = d.hp;
  const rounds = [];
  for (let i = 0; i < 8 && aHp > 0 && dHp > 0; i++) {
    let aDmg = Math.max(1, a.atk - Math.floor(d.def * 0.5) + Math.floor(Math.random() * 10));
    const aCrit = Math.random() < a.crit;
    if (aCrit) aDmg = Math.floor(aDmg * 1.8);
    dHp -= aDmg;
    let dDmg = 0, dCrit = false;
    if (dHp > 0) {
      dDmg = Math.max(1, d.atk - Math.floor(a.def * 0.5) + Math.floor(Math.random() * 10));
      dCrit = Math.random() < d.crit;
      if (dCrit) dDmg = Math.floor(dDmg * 1.8);
      aHp -= dDmg;
    }
    rounds.push({ aDmg, aCrit, dDmg, dCrit });
  }
  return { attackerWon: dHp <= 0 || aHp > dHp, rounds };
}

// ─── Embeds ───────────────────────────────────────────────────────────────────
function dark(color = "#1a0a1e") {
  return new EmbedBuilder().setColor(color).setTimestamp()
    .setFooter({ text: "🌌 Isekai Chronicles  ·  The Chronicle of the Eternal Dark" });
}

function profileEmbed(char) {
  const race = RACES[char.race], cls = CLASSES[char.class];
  const statusIcon = { alive: "💚", ghost: "👻", dead: "💀" }[char.status] ?? "💀";
  const faction = char.faction ? db.factions[char.faction] : null;
  return dark(race.color)
    .setTitle(`${race.emoji} ${char.name}`)
    .setDescription(
      `*"${race.lore}"*\n\n` +
      `**Status:** ${statusIcon} ${cap(char.status)}` +
      (char.title ? `  ·  **Title:** ${char.title}` : "") +
      `\n**Faction:** ${faction ? `**${faction.name}**` : "*None — thou art an outsider.*"}`
    )
    .addFields(
      { name: "⚔️ Dark Path",   value: `${cls.emoji} ${cls.name}`,   inline: true },
      { name: "🧬 Bloodline",   value: `${race.emoji} ${race.name}`, inline: true },
      { name: "🏅 Standing",    value: `Level **${char.level}**`,     inline: true },
      { name: "❤️ Vitality",    value: `${hpBar(char.hp, char.maxHp)} **${char.hp}/${char.maxHp}**`,     inline: false },
      { name: "✨ Essence",     value: `${xpBar(char.xp, char.xpToNext)} **${char.xp}/${char.xpToNext}**`, inline: false },
      { name: "⚔️ Strike",     value: `**${char.atk}**`, inline: true },
      { name: "🛡️ Ward",       value: `**${char.def}**`, inline: true },
      { name: "🔮 Arcane",     value: `**${char.int}**`, inline: true },
      { name: "💨 Swiftness",  value: `**${char.spd}**`, inline: true },
      { name: "🎯 Crit",       value: `${Math.round(char.crit * 100)}%`, inline: true },
      { name: "💰 Void Crystals", value: `${char.coins} 🔷`, inline: true },
      { name: "📊 Chronicle",  value: `Quests **${char.questsCompleted}** · Victories **${char.battlesWon}** · Deaths **${char.deaths}**`, inline: false },
    );
}

function worldEmbed() {
  const factions = Object.values(db.factions);
  const ev = db.world.currentEvent;
  return dark("#1a0a1e")
    .setTitle("🌍 The World of Eternal Night")
    .setDescription(
      "*From the ashes of a realm not meant to survive, a world was born. Those who crossed the veil built it — stone by shadow.*\n\n" +
      (ev ? `**🌀 The Omen of This Day:** ${ev.name}\n*${ev.desc}*` : "*The realm breathes quietly. No great omen stirs the dark this day.*")
    )
    .addFields(
      { name: "⚔️ Powers of the Realm", value: factions.length ? factions.map(f => `**${f.name}** — ${f.members.length} sworn member(s)`).join("\n") : "*No faction has yet raised its banner. Be the first to carve a name into the dark.*", inline: false },
      { name: "📜 Chronicle Entries",   value: `${db.world.lore.length}`, inline: true },
      { name: "👥 Souls in this World",  value: `${Object.keys(db.users).length}`, inline: true },
    );
}

function leaderboardEmbed(chars) {
  const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
  return dark("#FFD700")
    .setTitle("📖 The Eternal Dark Ledger  —  Most Powerful Souls")
    .setDescription(
      "*The scribes of the Void Court record the names of those who have proven their worth. These are the strongest who yet breathe.*\n\u200b"
    )
    .addFields({ name: "\u200b", value: chars.map((c, i) => {
      const r = RACES[c.race], cl = CLASSES[c.class];
      return `${medals[i]} **${c.name}** — ${r?.emoji} ${r?.name} ${cl?.emoji} ${cl?.name} · Level **${c.level}** · Power **${Math.round(powerScore(c))}**`;
    }).join("\n"), inline: false });
}

function achievementEmbed(char, ach) {
  const race = RACES[char.race];
  return dark(race?.color ?? "#4B0082")
    .setTitle(`${ach.emoji} Achievement Unlocked — ${ach.name}`)
    .setDescription(`**${char.name}** hath earned a new mark upon the chronicle.\n\n*"${ach.desc}"*`);
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function announceAchievement(char, ach, guild) {
  if (!guild || !db.config.leaderboardChannelId) return;
  const channel = guild.channels.cache.get(db.config.leaderboardChannelId);
  if (!channel) return;
  await channel.send({ embeds: [achievementEmbed(char, ach)] }).catch(() => null);
}

async function maybeUpdateLeaderboard(guild) {
  if (!guild || !db.config.leaderboardChannelId) return;
  const chars = Object.values(db.users).sort((a, b) => powerScore(b) - powerScore(a)).slice(0, 10);
  const top3now = chars.slice(0, 3).map(c => c.userId);
  const top3old = (db.config.lastLeaderboard ?? []).slice(0, 3);
  const changed = top3now.some((id, i) => id !== top3old[i]);
  if (!changed) return;
  db.config.lastLeaderboard = chars.map(c => c.userId);
  saveData();
  const channel = guild.channels.cache.get(db.config.leaderboardChannelId);
  if (!channel || !chars.length) return;
  await channel.send({ embeds: [leaderboardEmbed(chars)
    .setTitle("📖 The Ledger Shifts — The Standings Have Changed")
    .setDescription("*The scribes have re-inked the ranks. A new order asserts itself in the realm.*\n\u200b")] }).catch(() => null);
}

// ─── Achievement Checker ──────────────────────────────────────────────────────
async function checkAchievements(char, guild) {
  if (!char.achievements) char.achievements = [];
  const earned = [];
  for (const ach of ACHIEVEMENTS) {
    if (char.achievements.includes(ach.id)) continue;
    if (ach.check(char)) {
      char.achievements.push(ach.id);
      earned.push(ach);
    }
  }
  for (const ach of earned) {
    await announceAchievement(char, ach, guild).catch(() => null);
  }
  if (earned.length) saveData();
  return earned;
}

// ─── Context Adapter ─────────────────────────────────────────────────────────
// Normalises message vs interaction into a single ctx object
function msgCtx(message) {
  return {
    userId:  message.author.id,
    guild:   message.guild,
    ephemeral: false,
    getUser(optionName) { return message.mentions.users.first() ?? null; },
    getString(name) { return null; }, // not used for prefix commands
    reply(opts) {
      if (typeof opts === "string") return message.reply(opts);
      return message.reply(opts);
    },
  };
}

function slashCtx(interaction) {
  return {
    userId:  interaction.user.id,
    guild:   interaction.guild,
    ephemeral: true,
    getUser(optionName) { return interaction.options.getUser(optionName) ?? null; },
    getString(name) { return interaction.options.getString(name) ?? null; },
    async reply(opts) {
      const payload = typeof opts === "string" ? { content: opts, ephemeral: true } : { ...opts, ephemeral: true };
      if (interaction.deferred) return interaction.editReply(payload);
      return interaction.reply(payload);
    },
  };
}

// ─── Character Creation Flow (prefix only) ───────────────────────────────────
const PENDING = new Map();

async function handleCreate(ctx) {
  const uid = ctx.userId;
  if (db.users[uid]) {
    return ctx.reply({ embeds: [dark(RACES[db.users[uid].race].color)
      .setTitle("📖 Thine Soul Is Already Recorded")
      .setDescription("Thou art already inscribed in the Eternal Ledger. Use `/profile` to behold thy record.")] });
  }
  if (ctx.ephemeral) {
    // Slash command — require options (handled in interactionCreate directly)
    return ctx.reply({ embeds: [dark().setTitle("⚠️ Use `/create name: race: class:`").setDescription("When using slash commands, provide all three options at once.")] });
  }
  PENDING.set(uid, { step: "name" });
  return ctx.reply({ embeds: [dark("#1a0a1e")
    .setTitle("🌌 The Veil Parts — Thou Art Summoned")
    .setDescription(
      "*Another world breathes its first breath upon thee. The chronicle awaits thy name.*\n\n" +
      "**Step I of III — What art thou called?**\n*Reply with thy character's name (2–32 letters).*"
    )] });
}

async function handleCreationFlow(message, state) {
  const uid = message.author.id;
  const val = message.content.trim();

  if (state.step === "name") {
    if (val.length < 2 || val.length > 32) return message.reply("❌ *The scribes require a name of 2 to 32 letters. Try again.*");
    state.name = val; state.step = "race"; PENDING.set(uid, state);
    const list = Object.entries(RACES).map(([k, r]) =>
      `${r.emoji} \`${k}\` **${r.name}** — Strike ${r.atk} · Ward ${r.def} · Arcane ${r.int} · Speed ${r.spd} · HP ${r.hp}\n*${r.lore}*`
    ).join("\n\n");
    return message.reply({ embeds: [dark("#1a0a1e").setTitle("🧬 Step II of III — Declare Thy Bloodline").setDescription(`*From what dark lineage dost thou hail?*\n\nReply with the bloodline key.\n\n${list}`)] });
  }

  if (state.step === "race") {
    const key = val.toLowerCase().replace(/\s+/g, "_");
    if (!RACES[key]) return message.reply(`❌ *The scribes do not recognise that bloodline. Choose from:* \`${Object.keys(RACES).join("`, `")}\``);
    state.race = key; state.step = "class"; PENDING.set(uid, state);
    const list = Object.entries(CLASSES).map(([k, c]) =>
      `${c.emoji} \`${k}\` **${c.name}** — Strike +${c.atk} · Ward +${c.def} · Arcane +${c.int} · Speed +${c.spd} · HP ${c.hp >= 0 ? "+" : ""}${c.hp} · Crit ${Math.round(c.crit * 100)}%\n*${c.lore}*`
    ).join("\n\n");
    return message.reply({ embeds: [dark(RACES[key].color).setTitle("⚔️ Step III of III — Choose Thy Dark Path").setDescription(`*What manner of destruction dost thou bring to this world?*\n\nReply with the path key.\n\n${list}`)] });
  }

  if (state.step === "class") {
    const key = val.toLowerCase();
    if (!CLASSES[key]) return message.reply(`❌ *That path is not written in this world. Choose from:* \`${Object.keys(CLASSES).join("`, `")}\``);
    const char = createCharacter(uid, state.name, state.race, key);
    db.users[uid] = char; PENDING.delete(uid);
    db.world.lore.push({ text: `**${state.name}** the ${RACES[state.race].name} ${CLASSES[key].name} crossed the veil and entered this world.`, timestamp: Date.now() });
    saveData();
    await checkAchievements(char, message.guild);
    return message.reply({ embeds: [profileEmbed(char)
      .setTitle(`${RACES[state.race].emoji} ${state.name} Enters the World`)
      .setDescription(`*The veil closes behind thee. There is no going back.*\n\nThou begin with **100 Void Crystals 🔷**.\nSpeak \`!quest\` to embark on thy first venture into the dark.`)] });
  }
}

async function createViaSlash(interaction) {
  const uid  = interaction.user.id;
  const name = interaction.options.getString("name");
  const race = interaction.options.getString("race");
  const cls  = interaction.options.getString("class");

  if (db.users[uid]) {
    return interaction.reply({ ephemeral: true, embeds: [dark(RACES[db.users[uid].race]?.color)
      .setTitle("📖 Thine Soul Is Already Recorded")
      .setDescription("Thou art already inscribed in the Eternal Ledger. Use `/profile` to behold thy record.")] });
  }
  if (name.length < 2 || name.length > 32) return interaction.reply({ ephemeral: true, content: "❌ *Thy name must be 2–32 letters long.*" });

  const char = createCharacter(uid, name, race, cls);
  db.users[uid] = char;
  db.world.lore.push({ text: `**${name}** the ${RACES[race].name} ${CLASSES[cls].name} crossed the veil and entered this world.`, timestamp: Date.now() });
  saveData();
  await checkAchievements(char, interaction.guild);
  return interaction.reply({ ephemeral: true, embeds: [profileEmbed(char)
    .setTitle(`${RACES[race].emoji} ${name} Enters the World`)
    .setDescription(`*The veil closes behind thee. There is no going back.*\n\nThou begin with **100 Void Crystals 🔷**.\nSpeak \`/quest\` to embark on thy first venture into the dark.`)] });
}

// ─── Command Handlers (all accept ctx) ───────────────────────────────────────
async function cmdProfile(ctx, targetUserId) {
  const tid  = targetUserId ?? ctx.userId;
  const char = db.users[tid];
  if (!char) return ctx.reply({ embeds: [dark().setTitle("📜 No Soul Record Found").setDescription(tid === ctx.userId ? "Thou hast not yet crossed the veil. Speak `/create` to enter this world." : "No soul record exists for that wanderer.")] });
  return ctx.reply({ embeds: [profileEmbed(char)] });
}

async function cmdWorld(ctx) {
  return ctx.reply({ embeds: [worldEmbed()] });
}

async function cmdEvent(ctx) {
  const ev = db.world.currentEvent;
  if (!ev) return ctx.reply({ embeds: [dark().setTitle("🌌 No Omen Stirs This Day").setDescription("The realm breathes quietly. No dark omen has descended today.")] });
  return ctx.reply({ embeds: [dark("#1a0a1e").setTitle(ev.name).setDescription(`*${ev.desc}*\n\n*This omen endures until midnight claims the day.*`)] });
}

async function cmdDaily(ctx) {
  const char = db.users[ctx.userId];
  if (!char) return ctx.reply({ embeds: [dark().setTitle("📜 No Soul Record Found").setDescription("Thou hast not yet crossed the veil. Speak `/create` to enter this world.")] });
  const COOLDOWN = 20 * 60 * 60 * 1000;
  const now = Date.now();
  if (char.lastDaily && (now - char.lastDaily) < COOLDOWN) {
    const rem = Math.ceil((COOLDOWN - (now - char.lastDaily)) / 1000 / 60 / 60);
    return ctx.reply({ embeds: [dark().setTitle("⏳ The Realm Hath Not Yet Forgotten Thee").setDescription(`The dark gives its gifts but once a day. Return in **${rem} hour(s)**, wanderer.`)] });
  }
  const crystals = 50 + Math.floor(char.level * 5);
  const xpGain   = 30;
  char.coins += crystals; char.lastDaily = now;
  const leveled = giveXP(char, xpGain);
  const earned = await checkAchievements(char, ctx.guild);
  await maybeUpdateLeaderboard(ctx.guild);
  saveData();
  return ctx.reply({ embeds: [dark("#FFD700")
    .setTitle("🎁 The Realm's Daily Tithe")
    .setDescription(`**${char.name}** collects what the dark owes them.`)
    .addFields(
      { name: "💰 Void Crystals", value: `+${crystals} 🔷  (Total: ${char.coins})`, inline: true },
      { name: "✨ Essence",       value: `+${xpGain}${leveled ? ` — *The power surges. Level **${char.level}** attained.*` : ""}`, inline: true },
      ...(earned.length ? [{ name: "🏆 Achievements", value: earned.map(a => `${a.emoji} ${a.name}`).join("\n"), inline: false }] : []),
    )] });
}

async function cmdQuest(ctx, sub, questId) {
  const char = db.users[ctx.userId];
  if (!char) return ctx.reply({ embeds: [dark().setTitle("📜 No Soul Record Found").setDescription("Thou hast not yet crossed the veil. Speak `/create` to enter this world.")] });
  if (char.status !== "alive") return ctx.reply({ embeds: [dark("#8B0000").setTitle("💀 The Dead Do Not Venture Forth").setDescription("Departed souls may not tread the questing roads. Seek resurrection first.")] });

  // ── return ──────────────────────────────────────────────────────────────────
  if (sub === "return") {
    if (!char.currentQuest) return ctx.reply({ embeds: [dark().setTitle("📜 No Quest Is Upon Thee").setDescription("Thou art not presently bound to any quest.")] });
    if (Date.now() < char.currentQuest.endAt) {
      const rem = Math.ceil((char.currentQuest.endAt - Date.now()) / 60000);
      return ctx.reply({ embeds: [dark("#FEE75C").setTitle("⏳ The Quest Is Not Yet Finished").setDescription(`**${rem} minute(s)** remain before thou may return. Patience, wanderer.`)] });
    }
    const quest = QUEST_POOL.find(q => q.id === char.currentQuest.questId);
    const isRes = char.currentQuest.isResurrection;
    char.currentQuest = null;

    if (quest?.deathChance > 0 && Math.random() < quest.deathChance && !isRes) {
      char.status = "ghost"; char.hp = 0; char.deaths++;
      db.world.lore.push({ text: `**${char.name}** perished during *${quest.name}* and now haunts the realm as a wraith.`, timestamp: Date.now() });
      const earned = await checkAchievements(char, ctx.guild);
      saveData();
      return ctx.reply({ embeds: [dark("#8B0000")
        .setTitle("💀 The Quest Claims Thee")
        .setDescription(`*The darkness swallowed **${char.name}** whole.*\n\n**${char.name}** did not return from *${quest.name}*.\n\nThou art now a 👻 **wraith** — use \`/resurrect\` to begin thy return, or purchase the **Resurrection Stone** from \`/shop\`.`)] });
    }
    if (isRes) {
      char.status = "alive"; char.hp = Math.floor(char.maxHp * 0.5);
      db.world.lore.push({ text: `**${char.name}** clawed back from the void and returned to the living realm.`, timestamp: Date.now() });
      saveData();
      return ctx.reply({ embeds: [dark("#4B0082")
        .setTitle("💜 Thou Hast Risen")
        .setDescription(`*Death remembers **${char.name}**, but could not hold them.*\n\nThou art alive once more — ${char.hp}/${char.maxHp} HP remains. Tread carefully, for the void knows thy face now.`)] });
    }
    const leveled = giveXP(char, quest.xp);
    char.coins += quest.coins; char.questsCompleted++;
    const earned = await checkAchievements(char, ctx.guild);
    await maybeUpdateLeaderboard(ctx.guild);
    saveData();
    return ctx.reply({ embeds: [dark("#57F287")
      .setTitle(`✅ The Quest Is Done — ${quest.name}`)
      .setDescription(`*The shadows part. **${char.name}** returns, victorious, stained with the dark.*`)
      .addFields(
        { name: "✨ Essence Gained",  value: `+${quest.xp}${leveled ? ` — *Level **${char.level}** hath been attained. The realm shivers.*` : ""}`, inline: true },
        { name: "💰 Crystals Seized", value: `+${quest.coins} 🔷  (Total: ${char.coins})`, inline: true },
        ...(earned.length ? [{ name: "🏆 Achievements Earned", value: earned.map(a => `${a.emoji} ${a.name}`).join("\n"), inline: false }] : []),
      )] });
  }

  // ── start ────────────────────────────────────────────────────────────────────
  if (sub === "start") {
    if (char.currentQuest) return ctx.reply({ embeds: [dark("#FEE75C").setTitle("⏳ A Quest Already Binds Thee").setDescription("Finish what thou hast begun before seeking new darkness. Use `/quest return`.")] });
    const quest = QUEST_POOL.find(q => q.id === questId);
    if (!quest) return ctx.reply({ embeds: [dark().setTitle("📜 That Quest Is Unknown to the Scribes").setDescription("Use `/quest list` to see the paths available to thee.")] });
    char.currentQuest = { questId: quest.id, startedAt: Date.now(), endAt: Date.now() + quest.durationMs };
    saveData();
    return ctx.reply({ embeds: [dark(diffColor(quest.difficulty))
      .setTitle(`⚔️ The Quest Begins — ${quest.name}`)
      .setDescription(`*The fates are sealed. **${char.name}** steps into the dark.*\n\n${quest.desc}`)
      .addFields(
        { name: "⏱️ Return in",   value: `${Math.floor(quest.durationMs / 60000)} minutes`, inline: true },
        { name: "💀 Death Risk", value: quest.deathChance > 0 ? `${Math.round(quest.deathChance * 100)}%` : "None", inline: true },
      )
      .setFooter({ text: "Speak /quest return when the time is spent." })] });
  }

  // ── list ─────────────────────────────────────────────────────────────────────
  if (char.currentQuest) {
    const quest = QUEST_POOL.find(q => q.id === char.currentQuest.questId);
    const rem = Math.max(0, Math.ceil((char.currentQuest.endAt - Date.now()) / 60000));
    return ctx.reply({ embeds: [dark("#FEE75C")
      .setTitle("⏳ A Quest Holds Thee")
      .setDescription(`Thou art bound to **${quest?.name ?? "an unknown quest"}**.\n${rem > 0 ? `**${rem} minute(s)** remain before thy return.` : `*The quest is done. Speak \`/quest return\` to claim what was earned.*`}`)] });
  }
  const embed = dark("#1a0a1e").setTitle("📜 The Questing Roads of the Realm").setDescription("*Many paths lead into darkness. Few who walk them return unchanged.*\nSpeak `/quest start` with a quest ID to begin.\n\u200b");
  for (const q of QUEST_POOL) {
    embed.addFields({ name: `${q.name}  ·  \`${q.id}\``, value: `*${q.desc}*\n⚠️ **${cap(q.difficulty)}** · ✨ ${q.xp} essence · 💰 ${q.coins} 🔷 · ⏱️ ${Math.floor(q.durationMs/60000)} min${q.deathChance > 0 ? ` · 💀 ${Math.round(q.deathChance*100)}% death risk` : ""}`, inline: false });
  }
  return ctx.reply({ embeds: [embed] });
}

async function cmdFaction(ctx, sub, name) {
  const uid = ctx.userId;
  const char = db.users[uid];
  if (!char) return ctx.reply({ embeds: [dark().setTitle("📜 No Soul Record Found").setDescription("Thou hast not yet crossed the veil. Speak `/create` to enter this world.")] });

  if (!sub || sub === "info") {
    const factions = Object.values(db.factions);
    if (!factions.length) return ctx.reply({ embeds: [dark().setTitle("⚔️ No Faction Has Yet Risen").setDescription("The realm awaits its first lord. Speak `/faction create` to raise your banner.")] });
    if (char.faction) {
      const f = db.factions[char.faction];
      if (f) return ctx.reply({ embeds: [dark("#4B0082")
        .setTitle(`⚔️ ${f.name}`)
        .addFields(
          { name: "👑 Lord/Lady",   value: `<@${f.leaderId}>`, inline: true },
          { name: "👥 Sworn",       value: `${f.members.length}`, inline: true },
          { name: "💰 War Chest",   value: `${f.treasury} 🔷`, inline: true },
        )] });
    }
    return ctx.reply({ embeds: [dark("#4B0082").setTitle("⚔️ Powers of the Realm").setDescription(factions.map(f => `**${f.name}** — ${f.members.length} sworn · Lord: <@${f.leaderId}>`).join("\n"))] });
  }
  if (sub === "create") {
    if (char.faction) return ctx.reply({ embeds: [dark().setTitle("⚔️ Thou Art Already Sworn").setDescription("Leave thine current faction before founding another.")] });
    if (!name || name.length < 2 || name.length > 30) return ctx.reply("❌ *Faction name must be 2–30 letters.*");
    const id = `f_${Date.now()}`;
    db.factions[id] = { id, name, leaderId: uid, members: [uid], treasury: 0, createdAt: Date.now() };
    char.faction = id;
    db.world.lore.push({ text: `The faction **${name}** was raised from the dark by **${char.name}**.`, timestamp: Date.now() });
    const earned = await checkAchievements(char, ctx.guild);
    saveData();
    return ctx.reply({ embeds: [dark("#4B0082").setTitle(`⚔️ The Faction ${name} Is Born`).setDescription(`*A new power rises in the realm. The dark takes notice.*\n\nOthers may swear themselves to thee with \`/faction join ${name}\`.`)] });
  }
  if (sub === "join") {
    if (char.faction) return ctx.reply({ embeds: [dark().setTitle("⚔️ Thou Art Already Sworn").setDescription("Leave thine current faction before joining another.")] });
    const f = Object.values(db.factions).find(f => f.name.toLowerCase() === (name ?? "").toLowerCase());
    if (!f) return ctx.reply(`❌ *No faction by the name "${name}" walks this realm.*`);
    f.members.push(uid); char.faction = f.id; saveData();
    return ctx.reply({ embeds: [dark("#4B0082").setTitle(`⚔️ Sworn to ${f.name}`).setDescription(`*The oath is spoken. **${char.name}** is now bound to the banner of **${f.name}**.*`)] });
  }
  if (sub === "leave") {
    if (!char.faction) return ctx.reply({ embeds: [dark().setTitle("⚔️ Thou Art Unsworn").setDescription("Thou art not presently bound to any faction.")] });
    const f = db.factions[char.faction];
    if (f) {
      f.members = f.members.filter(id => id !== uid);
      if (f.leaderId === uid && f.members.length > 0) f.leaderId = f.members[0];
      else if (f.members.length === 0) { db.world.lore.push({ text: `The faction **${f.name}** collapsed as its last member departed.`, timestamp: Date.now() }); delete db.factions[char.faction]; }
    }
    char.faction = null; saveData();
    return ctx.reply({ embeds: [dark().setTitle("⚔️ The Oath Is Broken").setDescription("Thou art now without a banner. The realm judges thee as an outsider once more.")] });
  }
  if (sub === "war") {
    if (!char.faction) return ctx.reply({ embeds: [dark().setTitle("⚔️ Thou Art Unsworn").setDescription("Only those with a banner may declare war.")] });
    const mine = db.factions[char.faction];
    if (mine.leaderId !== uid) return ctx.reply({ embeds: [dark().setTitle("⚔️ Only the Lord May Declare War").setDescription("Thou dost not command this faction.")] });
    const theirs = Object.values(db.factions).find(f => f.name.toLowerCase() === (name ?? "").toLowerCase());
    if (!theirs) return ctx.reply(`❌ *No faction by the name "${name}" walks this realm.*`);
    if (theirs.id === char.faction) return ctx.reply("❌ *Thou canst not declare war upon thyself.*");
    const myPow    = mine.members.reduce((s, id) => s + (db.users[id] ? powerScore(db.users[id]) : 0), 0);
    const theirPow = theirs.members.reduce((s, id) => s + (db.users[id] ? powerScore(db.users[id]) : 0), 0);
    const won = Math.random() < (myPow / (myPow + theirPow || 1));
    const reward = 200;
    if (won) mine.treasury += reward; else theirs.treasury += reward;
    const lore = won
      ? `**${mine.name}** crushed **${theirs.name}** in open war and seized ${reward} 🔷 from the ashes.`
      : `**${theirs.name}** repelled the assault from **${mine.name}**, who fled into the dark and left ${reward} 🔷 behind.`;
    db.world.lore.push({ text: lore, timestamp: Date.now() });
    db.world.warHistory.push({ attacker: mine.name, defender: theirs.name, winner: won ? mine.name : theirs.name, timestamp: Date.now() });
    saveData();
    return ctx.reply({ embeds: [dark(won ? "#57F287" : "#ED4245")
      .setTitle(won ? `🏆 The War Is Won — ${mine.name} Triumphant` : `💀 The War Is Lost — ${theirs.name} Holds`)
      .setDescription(
        `**${mine.name}** (Power: ${Math.round(myPow)}) against **${theirs.name}** (Power: ${Math.round(theirPow)})\n\n*${lore}*`
      )] });
  }
  if (sub === "betray") {
    if (!char.faction) return ctx.reply({ embeds: [dark().setTitle("⚔️ Thou Art Unsworn").setDescription("One cannot betray a banner they do not carry.")] });
    if (!char.inventory.includes("betrayal_dagger")) return ctx.reply({ embeds: [dark("#8B0000").setTitle("🗡️ The Betrayer's Dagger Is Required").setDescription("Purchase the **Betrayer's Dagger** from `/shop` before treachery may be committed.")] });
    const target = Object.values(db.factions).find(f => f.name.toLowerCase() === (name ?? "").toLowerCase());
    if (!target) return ctx.reply(`❌ *No faction by the name "${name}" walks this realm.*`);
    const old = db.factions[char.faction];
    if (old) old.members = old.members.filter(id => id !== uid);
    target.members.push(uid); char.faction = target.id;
    char.coins += 150; char.inventory = char.inventory.filter(i => i !== "betrayal_dagger");
    db.world.lore.push({ text: `**${char.name}** betrayed the banner of **${old?.name ?? "their faction"}** and vanished into **${target.name}** under cover of night.`, timestamp: Date.now() });
    saveData();
    return ctx.reply({ embeds: [dark("#8B0000").setTitle("🗡️ The Betrayal Is Complete").setDescription(`*The dagger was true. The oath is ash.*\n\nThou hast slipped from **${old?.name}** and sworn thyself to **${target.name}**.\n+150 🔷 Treachery Bonus`)] });
  }
}

async function cmdAttack(ctx, targetUserId) {
  const uid  = ctx.userId;
  const char = db.users[uid];
  if (!char) return ctx.reply({ embeds: [dark().setTitle("📜 No Soul Record Found").setDescription("Thou hast not yet crossed the veil. Speak `/create` to enter this world.")] });
  if (char.status !== "alive") return ctx.reply({ embeds: [dark("#8B0000").setTitle("💀 The Dead Do Not Fight").setDescription("A wraith holds no sword. Seek resurrection first.")] });
  if (!targetUserId) return ctx.reply("❌ *Thou must name a target.*");
  if (targetUserId === uid) return ctx.reply("❌ *Thou canst not raise a blade against thyself.*");
  const tchar = db.users[targetUserId];
  if (!tchar) return ctx.reply({ embeds: [dark().setTitle("📜 No Soul Record Found").setDescription("That wanderer has not yet entered this world.")] });
  if (tchar.status !== "alive") return ctx.reply({ embeds: [dark().setTitle("💀 The Target Is Already Fallen").setDescription("One does not battle a wraith — send them to resurrection, not to war.")] });

  const result = simulateCombat(char, tchar);
  const winnerId = result.attackerWon ? uid : targetUserId;
  const loserId  = result.attackerWon ? targetUserId : uid;
  const winner   = db.users[winnerId], loser = db.users[loserId];

  const xpGain = 40, coinGain = 25;
  const leveled = giveXP(winner, xpGain);
  winner.coins += coinGain; winner.battlesWon++;
  loser.battlesLost++;
  loser.hp = Math.max(1, loser.hp - Math.floor(loser.maxHp * (0.1 + Math.random() * 0.2)));

  let died = false;
  if (loser.hp <= 5 && Math.random() < 0.05) {
    loser.status = "ghost"; loser.hp = 0; loser.deaths++; winner.killCount++;
    died = true;
    db.world.lore.push({ text: `**${winner.name}** slew **${loser.name}** in open combat. The fallen wanders the realm now as a wraith.`, timestamp: Date.now() });
  }

  const earned = await checkAchievements(winner, ctx.guild);
  await checkAchievements(loser, ctx.guild);
  await maybeUpdateLeaderboard(ctx.guild);
  saveData();

  const roundLog = result.rounds.slice(0, 3).map((r, i) =>
    `**Round ${i+1}:** ${char.name} strikes **${r.aDmg}${r.aCrit ? " 🎯" : ""}** — ${tchar.name} strikes **${r.dDmg}${r.dCrit ? " 🎯" : ""}**`
  ).join("\n");

  return ctx.reply({ embeds: [dark(result.attackerWon ? "#57F287" : "#ED4245")
    .setTitle(`⚔️ ${char.name} versus ${tchar.name}`)
    .setDescription(`${roundLog}${died ? `\n\n💀 ***${loser.name} has been slain. The void gains one more wraith.***` : ""}`)
    .addFields(
      { name: "🏆 The Victorious",  value: `**${winner.name}**`, inline: true },
      { name: "💀 The Vanquished",  value: `**${loser.name}**`,  inline: true },
      { name: "🏅 Spoils",          value: `+${xpGain} essence${leveled ? ` — *Level **${winner.level}** attained*` : ""} · +${coinGain} 🔷`, inline: false },
      ...(earned.length ? [{ name: "🏆 Achievements", value: earned.map(a => `${a.emoji} ${a.name}`).join("\n"), inline: false }] : []),
    )] });
}

async function cmdShop(ctx, sub, itemId) {
  const char = db.users[ctx.userId];
  if (!char) return ctx.reply({ embeds: [dark().setTitle("📜 No Soul Record Found").setDescription("Thou hast not yet crossed the veil. Speak `/create` to enter this world.")] });
  if (!sub || sub === "list") {
    const embed = dark("#483D8B").setTitle("🏪 The Void Market").setDescription(`*Wares of shadow and ruin, purchased with the currency of oblivion.*\n\nThy purse: **${char.coins} 🔷**  ·  Speak \`/shop buy\` to acquire.\n\u200b`);
    for (const item of SHOP_ITEMS) embed.addFields({ name: `${item.name}  (\`${item.id}\`)  —  ${item.price} 🔷`, value: `*${item.desc}*`, inline: false });
    return ctx.reply({ embeds: [embed] });
  }
  if (sub === "buy") {
    const item = SHOP_ITEMS.find(i => i.id === itemId);
    if (!item) return ctx.reply({ embeds: [dark().setTitle("🏪 The Market Does Not Stock That").setDescription("Use `/shop` to see what the Void Market carries.")] });
    if (char.coins < item.price) return ctx.reply({ embeds: [dark("#ED4245").setTitle("💰 Thine Coffers Are Insufficient").setDescription(`Thou needest **${item.price} 🔷** for this. Thou holdest only **${char.coins} 🔷**. Seek more before thy return.`)] });
    char.coins -= item.price;
    if (item.type === "consumable") {
      char.hp = Math.min(char.maxHp, char.hp + item.hpRestore);
      const earned = await checkAchievements(char, ctx.guild);
      saveData();
      return ctx.reply({ embeds: [dark("#57F287").setTitle(`✅ ${item.name} Consumed`).setDescription(`*The draught is drained. The wound closes.*\n\nVitality restored: ${hpBar(char.hp, char.maxHp)} **${char.hp}/${char.maxHp}**`)] });
    }
    if (item.type === "permanent") {
      for (const [stat, val] of Object.entries(item.statBoost)) char[stat] = (char[stat] ?? 0) + val;
      const earned = await checkAchievements(char, ctx.guild);
      await maybeUpdateLeaderboard(ctx.guild);
      saveData();
      return ctx.reply({ embeds: [dark("#483D8B").setTitle(`✅ ${item.name} — Power Absorbed`).setDescription(`*The dark gift settles into thy bones.*\n\n${Object.entries(item.statBoost).map(([k,v]) => `**+${v} ${k.toUpperCase()}**`).join("  ")}`)] });
    }
    if (item.type === "special") {
      if (item.id === "resurrection_stone") {
        if (char.status === "alive") { char.coins += item.price; saveData(); return ctx.reply({ embeds: [dark().setTitle("💜 Thou Art Already Breathing").setDescription("The Stone is for the fallen. Thou art not fallen.")] }); }
        char.status = "alive"; char.hp = Math.floor(char.maxHp * 0.5);
        db.world.lore.push({ text: `**${char.name}** shattered a Resurrection Stone and clawed back from the void.`, timestamp: Date.now() });
        const earned = await checkAchievements(char, ctx.guild);
        saveData();
        return ctx.reply({ embeds: [dark("#4B0082").setTitle("💜 The Stone Shatters — Thou Art Reborn").setDescription(`*The pale warmth floods through thee. Existence reasserts itself.*\n\n**${char.name}** returns to the realm — ${char.hp}/${char.maxHp} HP.`)] });
      }
      char.inventory.push(item.id);
      const earned = await checkAchievements(char, ctx.guild);
      saveData();
      return ctx.reply({ embeds: [dark("#483D8B").setTitle(`✅ ${item.name} — Added to Thy Inventory`).setDescription(`*${item.desc}*\n\nUse it wisely.`)] });
    }
  }
}

async function cmdLore(ctx) {
  const entries = db.world.lore.slice(-10).reverse();
  if (!entries.length) return ctx.reply({ embeds: [dark().setTitle("📜 The Chronicle Is Blank").setDescription("*No deeds have yet been recorded. Go forth, wander, fight, and forge history.*")] });
  const embed = dark("#1a0a1e").setTitle("📜 The World Chronicle — What Has Come to Pass").setDescription("*The scribes of the Void Court record all things. These are the last ten events written in the realm's blood.*\n\u200b");
  for (const e of entries) {
    embed.addFields({ name: new Date(e.timestamp).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), value: e.text, inline: false });
  }
  return ctx.reply({ embeds: [embed] });
}

async function cmdLeaderboard(ctx) {
  const chars = Object.values(db.users).sort((a, b) => powerScore(b) - powerScore(a)).slice(0, 10);
  if (!chars.length) return ctx.reply({ embeds: [dark().setTitle("📖 The Ledger Is Empty").setDescription("No souls have proven their worth yet. Be the first.")] });
  return ctx.reply({ embeds: [leaderboardEmbed(chars)] });
}

async function cmdResurrect(ctx) {
  const char = db.users[ctx.userId];
  if (!char) return ctx.reply({ embeds: [dark().setTitle("📜 No Soul Record Found").setDescription("Thou hast not yet crossed the veil. Speak `/create` to enter this world.")] });
  if (char.status === "alive") return ctx.reply({ embeds: [dark().setTitle("💜 Thou Art Already Breathing").setDescription("The void has not claimed thee. Resurrection is unnecessary.")] });
  if (char.currentQuest) return ctx.reply({ embeds: [dark().setTitle("⏳ The Resurrection Quest Already Binds Thee").setDescription("The trial is already underway. Speak `/quest return` when it is done.")] });
  char.currentQuest = { questId: "shadow_catacombs", startedAt: Date.now(), endAt: Date.now() + 5 * 60 * 1000, isResurrection: true };
  saveData();
  return ctx.reply({ embeds: [dark("#4B0082")
    .setTitle("💜 The Resurrection Trial Begins")
    .setDescription("*Death does not release without cost.*\n\n**${char.name}** must prove their worth to the realm once more.\n\nComplete *The Shadow Catacombs* in **5 minutes** and return with `/quest return`.\n\n*(Or purchase the **Resurrection Stone** from `/shop` for an immediate return.)*")
    .setFooter({ text: "Death remembers thee. Earn thy way back." })] });
}

async function cmdDeleteCharacter(ctx, confirm) {
  const uid  = ctx.userId;
  const char = db.users[uid];
  if (!char) return ctx.reply({ embeds: [dark().setTitle("📜 No Soul Record Found").setDescription("Thou hast no character to erase from the chronicle.")] });
  if ((confirm ?? "").toUpperCase() !== "CONFIRM") {
    return ctx.reply({ embeds: [dark("#ED4245")
      .setTitle("⚠️ Deletion Requires Confirmation")
      .setDescription(
        `This will **permanently erase ${char.name}** — all progress, levels, items, coins, and faction ties will be lost forever.\n\n` +
        `To confirm, use:\n\`/deletecharacter confirm:CONFIRM\`\n*(prefix: \`!deletecharacter CONFIRM\`)*`
      )] });
  }
  // Remove from faction
  if (char.faction && db.factions[char.faction]) {
    const f = db.factions[char.faction];
    f.members = f.members.filter(id => id !== uid);
    if (f.leaderId === uid && f.members.length > 0) f.leaderId = f.members[0];
    else if (f.members.length === 0) delete db.factions[char.faction];
  }
  const name = char.name;
  delete db.users[uid];
  db.world.lore.push({ text: `**${name}** has been erased from the chronicle. Their deeds fade like smoke.`, timestamp: Date.now() });
  saveData();
  return ctx.reply({ embeds: [dark("#8B0000")
    .setTitle("🗑️ Soul Erased from the Chronicle")
    .setDescription(`*The scribes draw a line through the name **${name}**. The realm forgets.*\n\nThy record has been permanently deleted. Use \`/create\` to begin anew.`)] });
}

async function cmdSetChannel(ctx, channelId) {
  const member = ctx.guild?.members.cache.get(ctx.userId);
  if (!member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return ctx.reply({ embeds: [dark("#ED4245").setTitle("⚔️ Thine Authority Is Insufficient").setDescription("Only those with **Manage Server** authority may bind the chronicle to a channel.")] });
  }
  db.config.leaderboardChannelId = channelId;
  db.config.lastLeaderboard = [];
  saveData();
  return ctx.reply({ embeds: [dark("#57F287").setTitle("📖 The Chronicle Channel Is Bound").setDescription(`The Eternal Ledger and achievement announcements shall henceforth be delivered to <#${channelId}>.\n\nOnly achievements and leaderboard shifts will be proclaimed there — all other activities remain private.`)] });
}

async function cmdHelp(ctx) {
  return ctx.reply({ embeds: [dark("#1a0a1e")
    .setTitle("🌌 Isekai Chronicles — The Compendium of Commands")
    .setDescription("*Everything thou needest to survive another world.*\n\u200b")
    .addFields(
      { name: "🎭 Soul & Character",  value: "`/create` · `/profile [@user]` · `/daily` · `/resurrect`", inline: false },
      { name: "🌍 The World",         value: "`/world` · `/event` · `/lore` · `/leaderboard`", inline: false },
      { name: "📜 Questing Roads",    value: "`/quest list` · `/quest start <id>` · `/quest return`", inline: false },
      { name: "⚔️ Combat",           value: "`/attack @user` — challenge another soul to battle", inline: false },
      { name: "🏰 Factions",         value: "`/faction info` · `/faction create <name>` · `/faction join <name>`\n`/faction leave` · `/faction war <name>` · `/faction betray <name>`", inline: false },
      { name: "🏪 The Void Market",   value: "`/shop` — browse · `/shop buy <id>` — purchase", inline: false },
      { name: "⚙️ Server Setup",      value: "`/setchannel #channel` — bind leaderboard & achievement announcements (Manage Server required)", inline: false },
      { name: "🧬 Bloodlines",        value: Object.entries(RACES).map(([k,r]) => `\`${k}\` ${r.emoji} ${r.name}`).join(" · "), inline: false },
      { name: "⚔️ Dark Paths",       value: Object.entries(CLASSES).map(([k,c]) => `\`${k}\` ${c.emoji} ${c.name}`).join(" · "), inline: false },
    )] });
}

// ─── Daily World Event ────────────────────────────────────────────────────────
function triggerDailyEvent() {
  const ev = WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)];
  db.world.currentEvent = ev;
  db.world.lastEventDate = new Date().toDateString();
  for (const char of Object.values(db.users)) {
    if (char.status !== "alive") continue;
    if (ev.effect === "hp_drain" && char.race !== "witch") char.hp = Math.max(1, char.hp - 10);
    if (ev.effect === "heal_all") char.hp = char.maxHp;
    if (ev.effect === "plague" && char.hp < char.maxHp * 0.4) char.hp = Math.max(1, char.hp - 15);
  }
  db.world.lore.push({ text: `**World Omen:** ${ev.name} — ${ev.desc}`, timestamp: Date.now() });
  saveData();
}
function checkDailyEvent() {
  if (db.world.lastEventDate !== new Date().toDateString()) triggerDailyEvent();
}

// ─── Slash Command Definitions ────────────────────────────────────────────────
const raceChoices    = Object.entries(RACES).map(([v,r]) => ({ name: `${r.emoji} ${r.name}`, value: v }));
const classChoices   = Object.entries(CLASSES).map(([v,c]) => ({ name: `${c.emoji} ${c.name}`, value: v }));
const questChoices   = QUEST_POOL.map(q => ({ name: `${q.name} (${q.difficulty})`, value: q.id }));
const shopChoices    = SHOP_ITEMS.map(i => ({ name: i.name, value: i.id }));
const questSubChoices = [{ name: "list", value: "list" }, { name: "start", value: "start" }, { name: "return", value: "return" }];

const SLASH_COMMANDS = [
  new SlashCommandBuilder().setName("create").setDescription("Cross the veil and summon thy soul into this dark world")
    .addStringOption(o => o.setName("name").setDescription("Thy character name (2–32 letters)").setRequired(true))
    .addStringOption(o => o.setName("race").setDescription("Thy bloodline").setRequired(true).addChoices(...raceChoices))
    .addStringOption(o => o.setName("class").setDescription("Thy dark path").setRequired(true).addChoices(...classChoices)),

  new SlashCommandBuilder().setName("profile").setDescription("Behold a soul's chronicle")
    .addUserOption(o => o.setName("user").setDescription("The soul to view (leave blank for thyself)").setRequired(false)),

  new SlashCommandBuilder().setName("world").setDescription("Look upon the world map and the omen of this day"),
  new SlashCommandBuilder().setName("event").setDescription("Hear the omen that grips the realm today"),
  new SlashCommandBuilder().setName("daily").setDescription("Claim thine daily tithe from the realm"),
  new SlashCommandBuilder().setName("lore").setDescription("Read the last ten entries in the World Chronicle"),
  new SlashCommandBuilder().setName("leaderboard").setDescription("View the most powerful souls recorded in the Eternal Ledger"),
  new SlashCommandBuilder().setName("resurrect").setDescription("Begin thine resurrection trial after death"),
  new SlashCommandBuilder().setName("deletecharacter").setDescription("Permanently erase thy character from the chronicle (irreversible)")
    .addStringOption(o => o.setName("confirm").setDescription("Type CONFIRM to permanently delete thy character").setRequired(false)),
  new SlashCommandBuilder().setName("help").setDescription("Open the Compendium of Commands"),

  new SlashCommandBuilder().setName("quest").setDescription("Walk the dark questing roads of the realm")
    .addStringOption(o => o.setName("action").setDescription("What to do").setRequired(true).addChoices(...questSubChoices))
    .addStringOption(o => o.setName("quest_id").setDescription("Quest ID when starting a quest").setRequired(false).addChoices(...questChoices)),

  new SlashCommandBuilder().setName("attack").setDescription("Challenge another soul to battle")
    .addUserOption(o => o.setName("target").setDescription("The soul thou wishest to challenge").setRequired(true)),

  new SlashCommandBuilder().setName("shop").setDescription("Browse or purchase from the Void Market")
    .addStringOption(o => o.setName("action").setDescription("What to do").setRequired(true).addChoices({ name: "browse", value: "list" }, { name: "buy", value: "buy" }))
    .addStringOption(o => o.setName("item_id").setDescription("Item to buy").setRequired(false).addChoices(...shopChoices)),

  new SlashCommandBuilder().setName("faction").setDescription("Manage thy faction allegiances")
    .addStringOption(o => o.setName("action").setDescription("What to do").setRequired(true)
      .addChoices(
        { name: "info / list all", value: "info" },
        { name: "create",          value: "create" },
        { name: "join",            value: "join" },
        { name: "leave",           value: "leave" },
        { name: "war",             value: "war" },
        { name: "betray",          value: "betray" },
      ))
    .addStringOption(o => o.setName("name").setDescription("Faction name (for create/join/war/betray)").setRequired(false)),

  new SlashCommandBuilder().setName("setchannel").setDescription("Bind the leaderboard & achievement channel (Manage Server required)")
    .addChannelOption(o => o.setName("channel").setDescription("Where to post public announcements").setRequired(true)
      .addChannelTypes(ChannelType.GuildText)),
].map(c => c.toJSON());

async function registerSlashCommands() {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN ?? process.env.DISCORD_BOT_TOKEN);
  // Register guild commands FIRST so commands are always live
  for (const guild of client.guilds.cache.values()) {
    try {
      await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), { body: SLASH_COMMANDS });
      console.log(`✅ Slash commands registered to guild ${guild.id}`);
    } catch (err) {
      console.error(`Slash registration error for guild ${guild.id}:`, err.message);
    }
  }
  // Then wipe global commands to remove any old duplicates
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
    console.log("✅ Global commands cleared");
  } catch (err) {
    console.error("Failed to clear global commands:", err.message);
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
});

const PREFIX = process.env.PREFIX ?? "!";

client.once("ready", async () => {
  console.log(`✅ Isekai Chronicles awoken as ${client.user.tag}`);
  client.user.setActivity("/create — Cross the Veil 🌌", { type: 0 });
  checkDailyEvent();
  setInterval(checkDailyEvent, 60 * 60 * 1000);
  await registerSlashCommands();
});

// ─── Prefix Commands ──────────────────────────────────────────────────────────
client.on("messageCreate", async (message) => {
  if (message.author.bot || message.channel.isDMBased()) return;
  const uid = message.author.id;

  if (PENDING.has(uid) && !message.content.startsWith(PREFIX)) {
    await handleCreationFlow(message, PENDING.get(uid)).catch(console.error);
    return;
  }

  if (db.users[uid]?.status === "alive") {
    const now = Date.now();
    if (!db.users[uid].lastActive || (now - db.users[uid].lastActive) > 60000) {
      db.users[uid].lastActive = now;
      giveXP(db.users[uid], 3);
      await checkAchievements(db.users[uid], message.guild);
      saveData();
    }
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args    = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  const ctx     = msgCtx(message);

  try {
    switch (command) {
      case "create":      await handleCreate(ctx); break;
      case "profile":     await cmdProfile(ctx, message.mentions.users.first()?.id); break;
      case "world":       await cmdWorld(ctx); break;
      case "event":       await cmdEvent(ctx); break;
      case "daily":       await cmdDaily(ctx); break;
      case "quest":       await cmdQuest(ctx, args[0]?.toLowerCase(), args[1]); break;
      case "faction":     await cmdFaction(ctx, args[0]?.toLowerCase(), args.slice(1).join(" ").trim()); break;
      case "attack":      await cmdAttack(ctx, message.mentions.users.first()?.id); break;
      case "shop":        await cmdShop(ctx, args[0]?.toLowerCase(), args[1]); break;
      case "lore":        await cmdLore(ctx); break;
      case "leaderboard": await cmdLeaderboard(ctx); break;
      case "resurrect":        await cmdResurrect(ctx); break;
      case "deletecharacter":  await cmdDeleteCharacter(ctx, args[0]); break;
      case "setchannel":       await cmdSetChannel(ctx, message.mentions.channels.first()?.id); break;
      case "help":             await cmdHelp(ctx); break;
    }
  } catch (err) {
    console.error(`[prefix:${command}]`, err);
    message.reply("⚠️ *The void glitches. Something went wrong.*").catch(() => null);
  }
});

// ─── Slash Commands ───────────────────────────────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const ctx = slashCtx(interaction);

  try {
    switch (interaction.commandName) {
      case "create":      await createViaSlash(interaction); break;
      case "profile":     await cmdProfile(ctx, interaction.options.getUser("user")?.id); break;
      case "world":       await cmdWorld(ctx); break;
      case "event":       await cmdEvent(ctx); break;
      case "daily":       await cmdDaily(ctx); break;
      case "quest":       await cmdQuest(ctx, interaction.options.getString("action"), interaction.options.getString("quest_id")); break;
      case "faction":     await cmdFaction(ctx, interaction.options.getString("action"), interaction.options.getString("name")); break;
      case "attack":      await cmdAttack(ctx, interaction.options.getUser("target")?.id); break;
      case "shop":        await cmdShop(ctx, interaction.options.getString("action"), interaction.options.getString("item_id")); break;
      case "lore":        await cmdLore(ctx); break;
      case "leaderboard": await cmdLeaderboard(ctx); break;
      case "resurrect":        await cmdResurrect(ctx); break;
      case "deletecharacter":  await cmdDeleteCharacter(ctx, interaction.options.getString("confirm")); break;
      case "setchannel":       await cmdSetChannel(ctx, interaction.options.getChannel("channel")?.id); break;
      case "help":             await cmdHelp(ctx); break;
    }
  } catch (err) {
    console.error(`[slash:${interaction.commandName}]`, err);
    const errMsg = { content: "⚠️ *The void glitches. Something went wrong.*", ephemeral: true };
    interaction.deferred ? interaction.editReply(errMsg) : interaction.reply(errMsg).catch(() => null);
  }
});

client.login(process.env.DISCORD_TOKEN ?? process.env.DISCORD_BOT_TOKEN);
