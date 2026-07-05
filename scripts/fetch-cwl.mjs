// Fetches the current CWL group + all round wars for a clan and writes
// a flat attack-level data.json that the site's frontend can render.
//
// Required environment variables (set as GitHub Actions secrets):
//   COC_API_TOKEN  - your Clash of Clans API token (registered to the
//                    RoyaleAPI proxy IPs, not your own IP)
//   CLAN_TAG       - your clan tag, e.g. #2CGG82GUJ

const BASE = 'https://cocproxy.royaleapi.dev/v1';
// const BASE = "https://api.clashofclans.com/v1";

const TOKEN = process.env.COC_API_TOKEN;
const CLAN_TAG = process.env.CLAN_TAG;

if (!TOKEN || !CLAN_TAG) {
  console.error("Missing COC_API_TOKEN or CLAN_TAG environment variable.");
  process.exit(1);
}

function encTag(tag) {
  return encodeURIComponent(tag.startsWith("#") ? tag : "#" + tag);
}

async function apiGet(path) {
  const res = await fetch(BASE + path, {
    headers: { Authorization: "Bearer " + TOKEN },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status} on ${path}: ${body}`);
  }
  return res.json();
}

async function main() {
  console.log("Fetching CWL group for", CLAN_TAG);
  const group = await apiGet(`/clans/${encTag(CLAN_TAG)}/currentwar/leaguegroup`);

  const attacks = [];
  let roundNumber = 0;

  for (const round of group.rounds) {
    roundNumber++;
    for (const warTag of round.warTags) {
      if (warTag === "#0") continue; // placeholder, war not started yet

      let war;
      try {
        war = await apiGet(`/clanwarleagues/wars/${encTag(warTag)}`);
      } catch (e) {
        console.warn("Skipping unavailable war tag", warTag, e.message);
        continue;
      }

      // Figure out which side is "our" clan
      const isClan1 = war.clan.tag.toUpperCase() === CLAN_TAG.toUpperCase().replace(/^#?/, "#");
      const ourClan = isClan1 ? war.clan : war.opponent;
      const otherClan = isClan1 ? war.opponent : war.clan;

      if (ourClan.tag.toUpperCase() !== CLAN_TAG.toUpperCase().replace(/^#?/, "#")) {
        // our clan tag didn't match either side, skip defensively
        continue;
      }

      for (const member of ourClan.members) {
        const ath = member.townhallLevel;
        if (member.attacks && member.attacks.length > 0) {
          const atk = member.attacks[0]; // CWL = 1 attack per member per war
          const defender = otherClan.members.find((m) => m.tag === atk.defenderTag);
          attacks.push({
            round: roundNumber,
            name: member.name,
            tag: member.tag,
            ath,
            dth: defender ? defender.townhallLevel : atk.defenderTag ? null : null,
            stars: atk.stars,
            dest: Math.round(atk.destructionPercentage * 100) / 100,
            missed: false,
          });
        } else {
          // no attack object at all = missed, but only counts if the war
          // has actually ended or is in progress with attack window closed;
          // include as missed once the war state is not "preparation"
          if (war.state !== "preparation") {
            attacks.push({
              round: roundNumber,
              name: member.name,
              tag: member.tag,
              ath,
              dth: null,
              stars: 0,
              dest: 0,
              missed: true,
            });
          }
        }
      }
    }
  }

  const output = {
    clanTag: CLAN_TAG,
    season: group.season,
    fetchedAt: new Date().toISOString(),
    attacks,
  };

  const fs = await import("fs");
  fs.writeFileSync("data.json", JSON.stringify(output, null, 2));
  console.log(`Wrote ${attacks.length} attack records to data.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
