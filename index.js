const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
} = require("discord.js");
const fs   = require("fs");
const path = require("path");
const http = require("http");
require("dotenv").config();

// ─── Health Check Server ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Isekai Chronicles is running.\n");
});
server.listen(PORT, () => console.log(`Health check on port ${PORT}`));
process.on("SIGTERM", () => { client.destroy(); server.close(() => process.exit(0)); });
process.on("SIGINT",  () => { client.destroy(); server.close(() => process.exit(0)); });

// ─── Data Layer ───────────────────────────────────────────────────────────────
const DATA_DIR  = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "world.json");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadData() {
  try { if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch {}
  return { users: {}, factions: {}, world: { lore: [], currentEvent: null, lastEventDate: null, warHistory: [] } };
}
function saveData() { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); }
let db = loadData();

// ─── Definitions ──────────────────────────────────────────────────────────────
const RACES = {
  demon:        { name: "Demon",        color: "#8B0000", emoji: "👿", hp: 120, atk: 25, def: 15, int: 20, spd: 10, lore: "Born from the abyss, Demons hunger for power and dominion." },
  fallen_angel: { name: "Fallen Angel", color: "#4B0082", emoji: "🪽", hp: 90,  atk: 10, def: 10, int: 40, spd: 25, lore: "Cast from the heavens, their grace became their curse." },
  cursed_human: { name: "Cursed Human", color: "#2F4F4F", emoji: "💀", hp: 110, atk: 20, def: 20, int: 20, spd: 20, lore: "Touched by ancient dark magic, cursed to wander between worlds." },
  vampire:      { name: "Vampire",      color: "#800020", emoji: "🧛", hp: 115, atk: 30, def: 10, int: 15, spd: 30, lore: "Immortal predators who drain life to sustain their eternal hunger." },
  witch:        { name: "Witch",        color: "#483D8B", emoji: "🧙", hp: 80,  atk: 10, def: 10, int: 50, spd: 15, lore: "Masters of forbidden arts, they bend reality to their will." },
};

const CLASSES = {
  assassin:    { name: "Assassin",    emoji: "🗡️",  atk: 20, def: 0,  int: 0,  spd: 20, hp: -10, crit: 0.25, lore: "Strike from the shadows before your foe can react." },
  mage:        { name: "Mage",        emoji: "🔮",  atk: 0,  def: 0,  int: 25, spd: 5,  hp: -10, crit: 0.10, lore: "Harness arcane energy to obliterate enemies from afar." },
  knight:      { name: "Knight",      emoji: "🛡️",  atk: 10, def: 25, int: 0,  spd: -5, hp: 30,  crit: 0.05, lore: "An unbreakable wall between allies and danger." },
  oracle:      { name: "Oracle",      emoji: "👁️",  atk: 0,  def: 5,  int: 20, spd: 15, hp: 0,   crit: 0.15, lore: "They see what others cannot — past, present, and doom." },
  necromancer: { name: "Necromancer", emoji: "☠️",  atk: 15, def: 0,  int: 20, spd: 0,  hp: 0,   crit: 0.10, lore: "Death is merely a tool in the necromancer's hands." },
};

const QUEST_POOL = [
  { id: "shadow_catacombs", name: "Shadow Catacombs",       desc: "Descend into an ancient tomb filled with restless undead.",                    difficulty: "easy",      xp: 50,  coins: 30,  durationMs: 3*60*1000,  deathChance: 0    },
  { id: "cursed_forest",    name: "The Cursed Forest",       desc: "Navigate a forest where time moves differently and the trees bleed.",          difficulty: "easy",      xp: 60,  coins: 40,  durationMs: 3*60*1000,  deathChance: 0    },
  { id: "void_fragment",    name: "The Void Fragment",       desc: "Retrieve a shard of pure void energy from the desolate wasteland.",            difficulty: "medium",    xp: 120, coins: 80,  durationMs: 5*60*1000,  deathChance: 0.05 },
  { id: "blood_moon_hunt",  name: "Blood Moon Hunt",         desc: "Hunt the monstrous creatures that emerge under the blood moon.",               difficulty: "medium",    xp: 140, coins: 90,  durationMs: 5*60*1000,  deathChance: 0.08 },
  { id: "demon_lord_trial", name: "Demon Lord's Trial",      desc: "Survive an audience with the Demon Lord himself. Few return unchanged.",        difficulty: "hard",      xp: 250, coins: 150, durationMs: 10*60*1000, deathChance: 0.15 },
  { id: "arcane_vault",     name: "The Arcane Vault",        desc: "Break into a sealed vault containing forbidden knowledge of the ancients.",     difficulty: "hard",      xp: 280, coins: 170, durationMs: 10*60*1000, deathChance: 0.20 },
  { id: "abyss_descent",    name: "Descent into the Abyss", desc: "Journey to the deepest layer of the underworld. Many do not return.",          difficulty: "legendary", xp: 500, coins: 300, durationMs: 15*60*1000, deathChance: 0.30 },
  { id: "world_rift",       name: "World Rift Expedition",   desc: "Venture through a rift that leads to an unknown realm beyond comprehension.",   difficulty: "legendary", xp: 600, coins: 350, durationMs: 15*60*1000, deathChance: 0.35 },
];

const WORLD_EVENTS = [
  { name: "🐉 Dragon Attack",       desc: "A massive dragon descends upon the realm! Battle rewards are doubled today.",       effect: "pvp_bonus"    },
  { name: "🌀 Portal Opening",      desc: "A mysterious portal tears open the sky. Quest XP rewards are doubled until midnight.", effect: "quest_bonus" },
  { name: "⛈️ Cursed Storm",        desc: "A dark storm sweeps the land. All living characters lose 10 HP. Witches are immune.", effect: "hp_drain"    },
  { name: "🌕 Blood Moon",          desc: "The moon runs red. Vampires and Assassins gain heightened combat power tonight.",     effect: "vampire_boost" },
  { name: "✨ Arcane Surge",        desc: "Raw magic floods the realm. Mages, Witches and Oracles feel the surge of power.",    effect: "magic_boost"  },
  { name: "☣️ The Plague",          desc: "A dark plague spreads through the realm. Weaker adventurers fall ill and lose HP.",  effect: "plague"       },
  { name: "⚔️ Grand Tournament",   desc: "The realm announces a Grand Tournament! All PvP rewards are doubled!",               effect: "tournament"   },
  { name: "🏚️ Ancient Tomb Found", desc: "Adventurers discover a massive ancient tomb. All quest loot is doubled today.",       effect: "quest_bonus"  },
  { name: "🖤 Dark Miracle",        desc: "An ancient deity bestows a dark miracle upon the realm. All characters regain full HP.", effect: "heal_all" },
  { name: "🕳️ Void Rift",          desc: "A rift to the void opens. Reality bends. The next quest started today is legendary.", effect: "void_rift"   },
];

const SHOP_ITEMS = [
  { id: "health_potion",      name: "Health Potion",       price: 50,  desc: "Restores 30 HP",                              type: "consumable", hpRestore: 30   },
  { id: "greater_potion",     name: "Greater Health Potion", price: 120, desc: "Restores full HP",                          type: "consumable", hpRestore: 99999 },
  { id: "void_shard",         name: "Void Shard",          price: 200, desc: "Permanently +15 ATK",                         type: "permanent",  statBoost: { atk: 15 } },
  { id: "shadow_cloak",       name: "Shadow Cloak",        price: 180, desc: "Permanently +20 SPD",                         type: "permanent",  statBoost: { spd: 20 } },
  { id: "arcane_tome",        name: "Arcane Tome",         price: 220, desc: "Permanently +20 INT",                         type: "permanent",  statBoost: { int: 20 } },
  { id: "iron_fortress",      name: "Iron Fortress",       price: 190, desc: "Permanently +20 DEF",                         type: "permanent",  statBoost: { def: 20 } },
  { id: "resurrection_stone", name: "Resurrection Stone",  price: 500, desc: "Instantly resurrect your dead character",     type: "special"  },
  { id: "betrayal_dagger",    name: "Betrayal Dagger",     price: 350, desc: "Defect to another faction secretly for +150 🔷 bonus", type: "special" },
  { id: "dark_elixir",        name: "Dark Elixir",         price: 300, desc: "Permanently +10 to ALL stats",               type: "permanent",  statBoost: { atk: 10, def: 10, int: 10, spd: 10 } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const RKEY = Object.keys(RACES).join("`, `");
const CKEY = Object.keys(CLASSES).join("`, `");

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
    faction: null, inventory: [],
    currentQuest: null,
    questsCompleted: 0, battlesWon: 0, battlesLost: 0, killCount: 0, deaths: 0,
    lastActive: Date.now(), createdAt: Date.now(),
    lastDaily: 0, title: null,
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
  return { attackerWon: dHp <= 0 || aHp > dHp, rounds, finalAHp: Math.max(0, aHp), finalDHp: Math.max(0, dHp) };
}

// ─── Embeds ───────────────────────────────────────────────────────────────────
function dark(color = "#1a0a1e") {
  return new EmbedBuilder().setColor(color).setTimestamp()
    .setFooter({ text: "🌌 Isekai Chronicles • Another World" });
}

function profileEmbed(char) {
  const race = RACES[char.race], cls = CLASSES[char.class];
  const statusIcon = { alive: "💚", ghost: "👻", dead: "💀" }[char.status] ?? "💀";
  const faction = char.faction ? db.factions[char.faction] : null;
  return dark(race.color)
    .setTitle(`${race.emoji} ${char.name}`)
    .setDescription(
      `*${race.lore}*\n\n` +
      `**Status:** ${statusIcon} ${char.status[0].toUpperCase() + char.status.slice(1)}` +
      (char.title ? `  ·  **Title:** ${char.title}` : "") +
      `\n**Faction:** ${faction ? `**${faction.name}**` : "*None*"}`
    )
    .addFields(
      { name: "⚔️ Class",  value: `${cls.emoji} ${cls.name}`,   inline: true },
      { name: "🧬 Race",   value: `${race.emoji} ${race.name}`, inline: true },
      { name: "🏅 Level",  value: `**${char.level}**`,           inline: true },
      { name: "❤️ HP",     value: `${hpBar(char.hp, char.maxHp)} ${char.hp}/${char.maxHp}`, inline: false },
      { name: "✨ XP",     value: `${xpBar(char.xp, char.xpToNext)} ${char.xp}/${char.xpToNext}`, inline: false },
      { name: "⚔️ ATK",   value: `**${char.atk}**`, inline: true },
      { name: "🛡️ DEF",   value: `**${char.def}**`, inline: true },
      { name: "🔮 INT",   value: `**${char.int}**`, inline: true },
      { name: "💨 SPD",   value: `**${char.spd}**`, inline: true },
      { name: "🎯 CRIT",  value: `${Math.round(char.crit * 100)}%`, inline: true },
      { name: "💰 Crystals", value: `${char.coins} 🔷`, inline: true },
      { name: "📊 Record", value: `Quests **${char.questsCompleted}** · Wins **${char.battlesWon}** · Deaths **${char.deaths}**`, inline: false },
    );
}

function worldEmbed() {
  const factions = Object.values(db.factions);
  const ev = db.world.currentEvent;
  return dark("#1a0a1e")
    .setTitle("🌍 The World of Eternal Night")
    .setDescription(
      "*A realm of darkness and wonder, forged by those who crossed between worlds.*\n\n" +
      (ev ? `**🌀 Today's Event:** ${ev.name}\n${ev.desc}` : "*The realm is quiet today. No world event.*")
    )
    .addFields(
      { name: "⚔️ Active Factions", value: factions.length ? factions.map(f => `**${f.name}** — ${f.members.length} member(s)`).join("\n") : "*No factions have risen yet.*", inline: false },
      { name: "📜 Lore Entries",    value: `${db.world.lore.length}`, inline: true },
      { name: "👥 Adventurers",     value: `${Object.keys(db.users).length}`, inline: true },
    );
}

// ─── Daily Event ──────────────────────────────────────────────────────────────
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
  db.world.lore.push({ text: `**World Event:** ${ev.name} — ${ev.desc}`, timestamp: Date.now() });
  saveData();
}

function checkDailyEvent() {
  if (db.world.lastEventDate !== new Date().toDateString()) triggerDailyEvent();
}

// ─── Character Creation Flow ──────────────────────────────────────────────────
const PENDING = new Map(); // userId -> { step, name?, race? }

async function handleCreate(message) {
  const uid = message.author.id;
  if (db.users[uid]) {
    const r = RACES[db.users[uid].race];
    return message.reply({ embeds: [dark(r.color).setTitle("✨ You Already Walk This World").setDescription("You already have a character! Use `!profile` to view your sheet.")] });
  }
  PENDING.set(uid, { step: "name" });
  return message.reply({ embeds: [dark("#1a0a1e")
    .setTitle("🌌 Welcome to Isekai Chronicles")
    .setDescription("You have been summoned to another world. Your legend begins now.\n\n**Step 1 of 3:** Type your **character's name** below.\n*(2–32 characters)*")] });
}

async function handleCreationFlow(message, state) {
  const uid = message.author.id;
  const val = message.content.trim();

  if (state.step === "name") {
    if (val.length < 2 || val.length > 32) return message.reply("❌ Name must be 2–32 characters. Try again.");
    state.name = val; state.step = "race"; PENDING.set(uid, state);
    const raceList = Object.entries(RACES).map(([k, r]) =>
      `${r.emoji} \`${k}\` **${r.name}** — HP ${r.hp} ATK ${r.atk} DEF ${r.def} INT ${r.int} SPD ${r.spd}\n*${r.lore}*`
    ).join("\n\n");
    return message.reply({ embeds: [dark("#1a0a1e").setTitle("🧬 Step 2 of 3 — Choose Your Race").setDescription(`Reply with the race **key** below.\n\n${raceList}`)] });
  }

  if (state.step === "race") {
    const key = val.toLowerCase().replace(/\s+/g, "_");
    if (!RACES[key]) return message.reply(`❌ Unknown race. Choose: \`${RKEY}\``);
    state.race = key; state.step = "class"; PENDING.set(uid, state);
    const classList = Object.entries(CLASSES).map(([k, c]) =>
      `${c.emoji} \`${k}\` **${c.name}** — ATK +${c.atk} DEF +${c.def} INT +${c.int} SPD +${c.spd} HP ${c.hp >= 0 ? "+" : ""}${c.hp} CRIT ${Math.round(c.crit * 100)}%\n*${c.lore}*`
    ).join("\n\n");
    return message.reply({ embeds: [dark(RACES[key].color).setTitle("⚔️ Step 3 of 3 — Choose Your Class").setDescription(`Reply with the class **key** below.\n\n${classList}`)] });
  }

  if (state.step === "class") {
    const key = val.toLowerCase();
    if (!CLASSES[key]) return message.reply(`❌ Unknown class. Choose: \`${CKEY}\``);
    const char = createCharacter(uid, state.name, state.race, key);
    db.users[uid] = char; PENDING.delete(uid);
    db.world.lore.push({ text: `**${state.name}** the ${RACES[state.race].name} ${CLASSES[key].name} arrived in this world.`, timestamp: Date.now() });
    saveData();
    return message.reply({ embeds: [profileEmbed(char)
      .setTitle(`${RACES[state.race].emoji} ${state.name} enters the world!`)
      .setDescription(`Welcome, **${state.name}**! You start with **100 Void Crystals 🔷**.\nUse \`!quest\` to begin your first adventure!`)] });
  }
}

// ─── Command Handlers ─────────────────────────────────────────────────────────
async function cmdProfile(message) {
  const tgt = message.mentions.users.first() ?? message.author;
  const char = db.users[tgt.id];
  if (!char) return message.reply(tgt.id === message.author.id ? "❌ No character yet — use `!create`!" : "❌ That user has no character.");
  return message.reply({ embeds: [profileEmbed(char)] });
}

async function cmdWorld(message) {
  return message.reply({ embeds: [worldEmbed()] });
}

async function cmdEvent(message) {
  const ev = db.world.currentEvent;
  if (!ev) return message.reply({ embeds: [dark().setTitle("🌌 No Event Today").setDescription("The realm is quiet... for now.")] });
  return message.reply({ embeds: [dark("#1a0a1e").setTitle(ev.name).setDescription(`${ev.desc}\n\n*This event is active until midnight.*`)] });
}

async function cmdDaily(message) {
  const uid = message.author.id;
  const char = db.users[uid];
  if (!char) return message.reply("❌ Use `!create` first!");
  const now = Date.now();
  const COOLDOWN = 20 * 60 * 60 * 1000; // 20 hours
  if (char.lastDaily && (now - char.lastDaily) < COOLDOWN) {
    const remaining = Math.ceil((COOLDOWN - (now - char.lastDaily)) / 1000 / 60 / 60);
    return message.reply(`⏳ Daily reward on cooldown. Come back in **${remaining} hour(s)**.`);
  }
  const crystals = 50 + Math.floor(char.level * 5);
  const xpGain   = 30;
  char.coins += crystals;
  char.lastDaily = now;
  const leveled = giveXP(char, xpGain);
  saveData();
  return message.reply({ embeds: [dark("#FFD700")
    .setTitle("🎁 Daily Reward Claimed!")
    .setDescription(`**${char.name}** collects their daily bounty from the realm.`)
    .addFields(
      { name: "💰 Void Crystals", value: `+${crystals} 🔷 (Total: ${char.coins})`, inline: true },
      { name: "✨ XP", value: `+${xpGain}${leveled ? ` (**LEVEL UP! Lv.${char.level}**)` : ""}`, inline: true },
    )] });
}

async function cmdQuest(message, args) {
  const uid = message.author.id;
  const char = db.users[uid];
  if (!char) return message.reply("❌ Use `!create` first!");
  if (char.status !== "alive") return message.reply("❌ Dead characters can't quest. Use `!resurrect` or buy a **Resurrection Stone** from `!shop`.");

  const sub = args[0]?.toLowerCase();

  // ── !quest return ───────────────────────────────────────────────────────────
  if (sub === "return") {
    if (!char.currentQuest) return message.reply("❌ You're not on a quest.");
    const now = Date.now();
    if (now < char.currentQuest.endAt) {
      const rem = Math.ceil((char.currentQuest.endAt - now) / 60000);
      return message.reply(`⏳ Quest in progress — **${rem} minute(s)** remaining.`);
    }
    const quest = QUEST_POOL.find(q => q.id === char.currentQuest.questId);
    const wasResurrection = char.currentQuest.isResurrection;
    char.currentQuest = null;

    // Death check
    if (quest && quest.deathChance > 0 && Math.random() < quest.deathChance && !wasResurrection) {
      char.status = "ghost"; char.hp = 0; char.deaths++;
      db.world.lore.push({ text: `**${char.name}** fell during *${quest.name}* and now haunts the realm.`, timestamp: Date.now() });
      saveData();
      return message.reply({ embeds: [dark("#8B0000")
        .setTitle("💀 You Died on Your Quest")
        .setDescription(`**${char.name}** did not return from *${quest.name}*.\n\nYou are now a 👻 **ghost**. Use \`!resurrect\` or buy a **Resurrection Stone** from \`!shop\`.`)] });
    }

    if (wasResurrection) {
      char.status = "alive"; char.hp = Math.floor(char.maxHp * 0.5);
      db.world.lore.push({ text: `**${char.name}** clawed back from death and returned to the realm.`, timestamp: Date.now() });
      saveData();
      return message.reply({ embeds: [dark("#4B0082")
        .setTitle("💜 You Have Risen")
        .setDescription(`**${char.name}** has been resurrected! You return with ${char.hp}/${char.maxHp} HP.\nYou are alive again!`)] });
    }

    const leveled = giveXP(char, quest.xp);
    char.coins += quest.coins; char.questsCompleted++;
    saveData();
    return message.reply({ embeds: [dark("#57F287")
      .setTitle(`✅ Quest Complete — ${quest.name}`)
      .setDescription(`**${char.name}** returns victorious from the darkness!`)
      .addFields(
        { name: "✨ XP Gained",    value: `+${quest.xp}${leveled ? ` (**LEVEL UP! Lv.${char.level}!**)` : ""}`, inline: true },
        { name: "💰 Crystals",     value: `+${quest.coins} 🔷 (Total: ${char.coins})`, inline: true },
      )] });
  }

  // ── !quest start <id> ────────────────────────────────────────────────────────
  if (sub === "start") {
    if (char.currentQuest) return message.reply("❌ Finish your current quest first with `!quest return`.");
    const qid = args[1];
    const quest = QUEST_POOL.find(q => q.id === qid);
    if (!quest) return message.reply("❌ Unknown quest ID. Use `!quest` to list quests.");
    char.currentQuest = { questId: quest.id, startedAt: Date.now(), endAt: Date.now() + quest.durationMs };
    saveData();
    return message.reply({ embeds: [dark(diffColor(quest.difficulty))
      .setTitle(`⚔️ Quest Begun — ${quest.name}`)
      .setDescription(`**${char.name}** ventures into the dark...\n\n${quest.desc}`)
      .addFields(
        { name: "⏱️ Return in",    value: `${Math.floor(quest.durationMs / 60000)} min`, inline: true },
        { name: "💀 Death Risk",   value: quest.deathChance > 0 ? `${Math.round(quest.deathChance * 100)}%` : "None", inline: true },
      )
      .setFooter({ text: "Use !quest return when the time is up!" })] });
  }

  // ── !quest (list) ────────────────────────────────────────────────────────────
  if (char.currentQuest) {
    const quest = QUEST_POOL.find(q => q.id === char.currentQuest.questId);
    const rem = Math.max(0, Math.ceil((char.currentQuest.endAt - Date.now()) / 60000));
    return message.reply({ embeds: [dark("#FEE75C")
      .setTitle("⏳ Quest in Progress")
      .setDescription(`Currently on **${quest?.name ?? "Unknown Quest"}**\n${rem > 0 ? `**${rem} minute(s)** remaining.` : `✅ Ready to return! Use \`!quest return\`.`}`)] });
  }

  const embed = dark("#1a0a1e").setTitle("📜 Available Quests").setDescription("Use `!quest start <id>` to begin.\n\u200b");
  for (const q of QUEST_POOL) {
    embed.addFields({ name: `${q.name} — \`${q.id}\``, value: `${q.desc}\n⚠️ **${q.difficulty}** · ✨ ${q.xp} XP · 💰 ${q.coins} 🔷 · ⏱️ ${Math.floor(q.durationMs/60000)}min${q.deathChance > 0 ? ` · 💀 ${Math.round(q.deathChance*100)}% death risk` : ""}`, inline: false });
  }
  return message.reply({ embeds: [embed] });
}

async function cmdFaction(message, args) {
  const uid = message.author.id;
  const char = db.users[uid];
  if (!char) return message.reply("❌ Use `!create` first!");

  const sub = args[0]?.toLowerCase();

  if (!sub || sub === "info") {
    const factions = Object.values(db.factions);
    if (!factions.length) return message.reply({ embeds: [dark().setTitle("⚔️ No Factions Yet").setDescription("Use `!faction create <name>` to found the first!")] });
    if (char.faction) {
      const f = db.factions[char.faction];
      if (f) return message.reply({ embeds: [dark("#4B0082")
        .setTitle(`⚔️ ${f.name}`)
        .setDescription(`*"${f.motto ?? "We rise from the darkness."}"*`)
        .addFields(
          { name: "👑 Leader",   value: `<@${f.leaderId}>`, inline: true },
          { name: "👥 Members",  value: `${f.members.length}`, inline: true },
          { name: "💰 Treasury", value: `${f.treasury} 🔷`, inline: true },
        )] });
    }
    return message.reply({ embeds: [dark("#4B0082").setTitle("⚔️ All Factions")
      .setDescription(factions.map(f => `**${f.name}** — ${f.members.length} member(s) · Leader: <@${f.leaderId}>`).join("\n"))] });
  }

  if (sub === "create") {
    if (char.faction) return message.reply("❌ Leave your current faction first with `!faction leave`.");
    const name = args.slice(1).join(" ").trim();
    if (!name || name.length < 2 || name.length > 30) return message.reply("❌ Name must be 2–30 characters.");
    const id = `f_${Date.now()}`;
    db.factions[id] = { id, name, leaderId: uid, members: [uid], treasury: 0, motto: null, createdAt: Date.now() };
    char.faction = id;
    db.world.lore.push({ text: `The faction **${name}** was founded by **${char.name}**.`, timestamp: Date.now() });
    saveData();
    return message.reply({ embeds: [dark("#4B0082").setTitle(`⚔️ Faction Founded — ${name}`).setDescription(`Others can join with \`!faction join ${name}\`.`)] });
  }

  if (sub === "join") {
    if (char.faction) return message.reply("❌ Leave your faction first.");
    const name = args.slice(1).join(" ").trim();
    const f = Object.values(db.factions).find(f => f.name.toLowerCase() === name.toLowerCase());
    if (!f) return message.reply(`❌ No faction named "${name}".`);
    f.members.push(uid); char.faction = f.id; saveData();
    return message.reply({ embeds: [dark("#4B0082").setTitle(`⚔️ Joined ${f.name}`).setDescription(`**${char.name}** pledges loyalty to **${f.name}**!`)] });
  }

  if (sub === "leave") {
    if (!char.faction) return message.reply("❌ You're not in a faction.");
    const f = db.factions[char.faction];
    if (f) {
      f.members = f.members.filter(id => id !== uid);
      if (f.leaderId === uid && f.members.length > 0) f.leaderId = f.members[0];
      else if (f.members.length === 0) { delete db.factions[char.faction]; db.world.lore.push({ text: `The faction **${f.name}** has dissolved — all members departed.`, timestamp: Date.now() }); }
    }
    char.faction = null; saveData();
    return message.reply("✅ You have left your faction.");
  }

  if (sub === "war") {
    if (!char.faction) return message.reply("❌ Join a faction first.");
    const mine = db.factions[char.faction];
    if (mine.leaderId !== uid) return message.reply("❌ Only faction leaders can declare war.");
    const tname = args.slice(1).join(" ").trim();
    const theirs = Object.values(db.factions).find(f => f.name.toLowerCase() === tname.toLowerCase());
    if (!theirs) return message.reply(`❌ No faction named "${tname}".`);
    if (theirs.id === char.faction) return message.reply("❌ Can't declare war on yourself.");

    const myPow    = mine.members.reduce((s, id) => s + (db.users[id] ? powerScore(db.users[id]) : 0), 0);
    const theirPow = theirs.members.reduce((s, id) => s + (db.users[id] ? powerScore(db.users[id]) : 0), 0);
    const won = Math.random() < (myPow / (myPow + theirPow || 1));
    const reward = 200;

    if (won) mine.treasury += reward; else theirs.treasury += reward;
    const lore = won
      ? `**${mine.name}** crushed **${theirs.name}** in battle and seized ${reward} 🔷.`
      : `**${theirs.name}** repelled the assault from **${mine.name}** and seized ${reward} 🔷.`;
    db.world.lore.push({ text: lore, timestamp: Date.now() });
    db.world.warHistory.push({ attacker: mine.name, defender: theirs.name, winner: won ? mine.name : theirs.name, timestamp: Date.now() });
    saveData();
    return message.reply({ embeds: [dark(won ? "#57F287" : "#ED4245")
      .setTitle(won ? `🏆 Victory! ${mine.name} Wins!` : `💀 Defeat! ${theirs.name} Holds!`)
      .setDescription(`**${mine.name}** (Power: ${Math.round(myPow)}) vs **${theirs.name}** (Power: ${Math.round(theirPow)})\n\n${won ? `Your faction was victorious! +${reward} 🔷 to treasury.` : `Your forces were repelled. ${theirs.name} gains ${reward} 🔷.`}`)] });
  }

  if (sub === "betray") {
    if (!char.faction) return message.reply("❌ You're not in a faction.");
    if (!char.inventory.includes("betrayal_dagger")) return message.reply("❌ You need a **Betrayal Dagger** from `!shop` to betray your faction.");
    const tname = args.slice(1).join(" ").trim();
    const target = Object.values(db.factions).find(f => f.name.toLowerCase() === tname.toLowerCase());
    if (!target) return message.reply(`❌ No faction named "${tname}".`);
    const old = db.factions[char.faction];
    if (old) old.members = old.members.filter(id => id !== uid);
    target.members.push(uid); char.faction = target.id;
    char.coins += 150; char.inventory = char.inventory.filter(i => i !== "betrayal_dagger");
    db.world.lore.push({ text: `**${char.name}** betrayed **${old?.name ?? "their faction"}** and defected to **${target.name}** in the shadows of the night.`, timestamp: Date.now() });
    saveData();
    return message.reply({ embeds: [dark("#8B0000").setTitle("🗡️ Betrayal Complete").setDescription(`You left **${old?.name}** and joined **${target.name}**!\n\n+150 🔷 Betrayal Bonus`)] });
  }
}

async function cmdAttack(message) {
  const uid = message.author.id;
  const char = db.users[uid];
  if (!char) return message.reply("❌ Use `!create` first!");
  if (char.status !== "alive") return message.reply("❌ Dead/ghost characters cannot fight.");
  const targetUser = message.mentions.users.first();
  if (!targetUser) return message.reply("❌ Mention a user: `!attack @user`");
  if (targetUser.id === uid) return message.reply("❌ You can't attack yourself.");
  const tchar = db.users[targetUser.id];
  if (!tchar) return message.reply("❌ That user has no character.");
  if (tchar.status !== "alive") return message.reply("❌ You can't attack a dead/ghost character.");

  const result = simulateCombat(char, tchar);
  const winnerId = result.attackerWon ? uid : targetUser.id;
  const loserId  = result.attackerWon ? targetUser.id : uid;
  const winner   = db.users[winnerId];
  const loser    = db.users[loserId];

  const xpGain = 40, coinGain = 25;
  const leveled = giveXP(winner, xpGain);
  winner.coins += coinGain; winner.battlesWon++;
  loser.battlesLost++;
  loser.hp = Math.max(1, loser.hp - Math.floor(loser.maxHp * (0.1 + Math.random() * 0.2)));

  let died = false;
  if (loser.hp <= 5 && Math.random() < 0.05) {
    loser.status = "ghost"; loser.hp = 0; loser.deaths++; winner.killCount++;
    died = true;
    db.world.lore.push({ text: `**${winner.name}** slew **${loser.name}** in combat. The fallen now haunts the realm.`, timestamp: Date.now() });
  }
  saveData();

  const roundLog = result.rounds.slice(0, 3).map((r, i) =>
    `**Round ${i+1}:** ${char.name} hits **${r.aDmg}${r.aCrit ? " 🎯" : ""}** — ${tchar.name} hits **${r.dDmg}${r.dCrit ? " 🎯" : ""}**`
  ).join("\n");

  return message.reply({ embeds: [dark(result.attackerWon ? "#57F287" : "#ED4245")
    .setTitle(`⚔️ ${char.name} vs ${tchar.name}`)
    .setDescription(`${roundLog}\n${died ? `\n💀 **${loser.name}** has been slain!` : ""}`)
    .addFields(
      { name: "🏆 Winner",   value: `**${winner.name}**`, inline: true },
      { name: "💀 Defeated", value: `**${loser.name}**`,  inline: true },
      { name: "🏅 Rewards",  value: `+${xpGain} XP${leveled ? ` (**LEVEL UP! Lv.${winner.level}**)` : ""} · +${coinGain} 🔷`, inline: false },
    )] });
}

async function cmdShop(message, args) {
  const uid = message.author.id;
  const char = db.users[uid];
  if (!char) return message.reply("❌ Use `!create` first!");
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === "list") {
    const embed = dark("#483D8B").setTitle("🏪 The Void Market").setDescription(`Balance: **${char.coins} 🔷** · Use \`!shop buy <id>\` to purchase.\n\u200b`);
    for (const item of SHOP_ITEMS) {
      embed.addFields({ name: `${item.name} (\`${item.id}\`) — ${item.price} 🔷`, value: item.desc, inline: false });
    }
    return message.reply({ embeds: [embed] });
  }

  if (sub === "buy") {
    const item = SHOP_ITEMS.find(i => i.id === args[1]);
    if (!item) return message.reply("❌ Unknown item. Use `!shop` to see items.");
    if (char.coins < item.price) return message.reply(`❌ Not enough Void Crystals. Need ${item.price} 🔷, have ${char.coins} 🔷.`);
    char.coins -= item.price;

    if (item.type === "consumable") {
      char.hp = Math.min(char.maxHp, char.hp + item.hpRestore);
      saveData();
      return message.reply({ embeds: [dark("#57F287").setTitle(`✅ Used ${item.name}`).setDescription(`HP restored! ${hpBar(char.hp, char.maxHp)} **${char.hp}/${char.maxHp}**`)] });
    }
    if (item.type === "permanent") {
      for (const [stat, val] of Object.entries(item.statBoost)) char[stat] = (char[stat] ?? 0) + val;
      saveData();
      return message.reply({ embeds: [dark("#483D8B").setTitle(`✅ Purchased ${item.name}`).setDescription(`Stats permanently boosted!\n${Object.entries(item.statBoost).map(([k, v]) => `**+${v} ${k.toUpperCase()}**`).join("  ")}`)] });
    }
    if (item.type === "special") {
      if (item.id === "resurrection_stone") {
        if (char.status === "alive") { char.coins += item.price; saveData(); return message.reply("❌ You're already alive!"); }
        char.status = "alive"; char.hp = Math.floor(char.maxHp * 0.5);
        db.world.lore.push({ text: `**${char.name}** rose from death using a Resurrection Stone.`, timestamp: Date.now() });
        saveData();
        return message.reply({ embeds: [dark("#4B0082").setTitle("💜 Resurrected!").setDescription(`**${char.name}** has returned from the dead with ${char.hp} HP!`)] });
      }
      char.inventory.push(item.id); saveData();
      return message.reply({ embeds: [dark("#483D8B").setTitle(`✅ Purchased ${item.name}`).setDescription(`Added to inventory. ${item.desc}`)] });
    }
  }
}

async function cmdLore(message) {
  const entries = db.world.lore.slice(-10).reverse();
  if (!entries.length) return message.reply({ embeds: [dark().setTitle("📜 The World Chronicle").setDescription("*No lore yet. Go on quests, fight, and forge history!*")] });
  const embed = dark("#1a0a1e").setTitle("📜 The World Chronicle").setDescription("*The last 10 events recorded in the realm.*\n\u200b");
  for (const e of entries) {
    embed.addFields({ name: new Date(e.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }), value: e.text, inline: false });
  }
  return message.reply({ embeds: [embed] });
}

async function cmdLeaderboard(message) {
  const chars = Object.values(db.users).sort((a, b) => powerScore(b) - powerScore(a)).slice(0, 10);
  if (!chars.length) return message.reply({ embeds: [dark().setTitle("🏆 Leaderboard").setDescription("No adventurers yet!")] });
  const medals = ["🥇","🥈","🥉","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];
  return message.reply({ embeds: [dark("#FFD700").setTitle("🏆 Most Powerful Adventurers")
    .setDescription(chars.map((c, i) => {
      const r = RACES[c.race], cl = CLASSES[c.class];
      return `${medals[i]} **${c.name}** — ${r?.emoji} ${r?.name} ${cl?.emoji} ${cl?.name} · Lv.**${c.level}** · Power **${Math.round(powerScore(c))}**`;
    }).join("\n"))] });
}

async function cmdResurrect(message) {
  const uid = message.author.id;
  const char = db.users[uid];
  if (!char) return message.reply("❌ Use `!create` first!");
  if (char.status === "alive") return message.reply("❌ You're already alive!");
  if (char.currentQuest) return message.reply("⏳ You're already on a resurrection quest. Use `!quest return` when it's done.");
  char.currentQuest = { questId: "shadow_catacombs", startedAt: Date.now(), endAt: Date.now() + 5 * 60 * 1000, isResurrection: true };
  saveData();
  return message.reply({ embeds: [dark("#4B0082")
    .setTitle("💜 Resurrection Quest Begun")
    .setDescription(`**${char.name}** must prove their worth to the realm.\n\nComplete *Shadow Catacombs* in **5 minutes** to return.\nUse \`!quest return\` when done.\n\n*(Or buy a **Resurrection Stone** from \`!shop\` for instant revival.)*`)
    .setFooter({ text: "Death is not the end... yet." })] });
}

async function cmdHelp(message) {
  return message.reply({ embeds: [dark("#1a0a1e")
    .setTitle("🌌 Isekai Chronicles — Command Guide")
    .setDescription("*Survive. Grow. Conquer. Build a legend.*\n\u200b")
    .addFields(
      { name: "🎭 Character",  value: "`!create` · `!profile [@user]` · `!daily` · `!resurrect`", inline: false },
      { name: "🌍 World",      value: "`!world` · `!event` · `!lore` · `!leaderboard`", inline: false },
      { name: "📜 Quests",     value: "`!quest` — list\n`!quest start <id>` — begin\n`!quest return` — collect rewards", inline: false },
      { name: "⚔️ Combat",    value: "`!attack @user` — challenge to a duel", inline: false },
      { name: "🏰 Factions",   value: "`!faction` · `!faction create <name>` · `!faction join <name>`\n`!faction leave` · `!faction war <name>` · `!faction betray <name>`", inline: false },
      { name: "🏪 Shop",       value: "`!shop` — view items\n`!shop buy <id>` — purchase", inline: false },
      { name: "🧬 Races",      value: Object.entries(RACES).map(([k, r]) => `\`${k}\` ${r.emoji} **${r.name}**`).join(" · "), inline: false },
      { name: "⚔️ Classes",   value: Object.entries(CLASSES).map(([k, c]) => `\`${k}\` ${c.emoji} **${c.name}**`).join(" · "), inline: false },
    )] });
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

client.once("ready", () => {
  console.log(`✅ Isekai Chronicles online as ${client.user.tag}`);
  client.user.setActivity("!create — Enter Another World 🌌", { type: 0 });
  checkDailyEvent();
  setInterval(checkDailyEvent, 60 * 60 * 1000);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || message.channel.isDMBased()) return;
  const uid = message.author.id;

  // Character creation interactive flow
  if (PENDING.has(uid) && !message.content.startsWith(PREFIX)) {
    await handleCreationFlow(message, PENDING.get(uid)).catch(console.error);
    return;
  }

  // Passive XP for activity (1 per minute cap)
  if (db.users[uid]?.status === "alive") {
    const now = Date.now();
    if (!db.users[uid].lastActive || (now - db.users[uid].lastActive) > 60000) {
      db.users[uid].lastActive = now;
      giveXP(db.users[uid], 3);
      saveData();
    }
  }

  if (!message.content.startsWith(PREFIX)) return;
  const args    = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  try {
    switch (command) {
      case "create":      await handleCreate(message); break;
      case "profile":     await cmdProfile(message); break;
      case "world":       await cmdWorld(message); break;
      case "event":       await cmdEvent(message); break;
      case "daily":       await cmdDaily(message); break;
      case "quest":       await cmdQuest(message, args); break;
      case "faction":     await cmdFaction(message, args); break;
      case "attack":      await cmdAttack(message); break;
      case "shop":        await cmdShop(message, args); break;
      case "lore":        await cmdLore(message); break;
      case "leaderboard": await cmdLeaderboard(message); break;
      case "resurrect":   await cmdResurrect(message); break;
      case "help":        await cmdHelp(message); break;
    }
  } catch (err) {
    console.error(`[${command}]`, err);
    await message.reply("⚠️ Something went wrong. The void glitches...").catch(() => null);
  }
});

client.login(process.env.DISCORD_TOKEN ?? process.env.DISCORD_BOT_TOKEN);
