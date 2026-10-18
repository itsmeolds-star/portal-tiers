// Portal Tiers demo data. Replace these sample players with your real rankings.
const players = [
  {name:"VoidReaper",mode:"Crystal",tier:"HT1",points:9840,avatar:"V",style:""},
  {name:"Kryzox",mode:"Sword",tier:"HT1",points:9510,avatar:"K",style:"pink"},
  {name:"Nexu",mode:"Axe",tier:"HT2",points:9125,avatar:"N",style:"alt"},
  {name:"FrostByte",mode:"Pot",tier:"HT2",points:8870,avatar:"F",style:""},
  {name:"OldBlitzor",mode:"Crystal",tier:"LT1",points:8420,avatar:"O",style:"pink"},
  {name:"RiftPvP",mode:"Sword",tier:"LT1",points:8160,avatar:"R",style:"alt"},
  {name:"PixelRush",mode:"Pot",tier:"LT2",points:7740,avatar:"P",style:""},
  {name:"EnderAce",mode:"Axe",tier:"LT3",points:7290,avatar:"E",style:"alt"}
];
const tierOrder = {HT1:0,HT2:1,LT1:2,LT2:3,LT3:4};
const rows = document.getElementById("leaderboardRows");
const modeSelect = document.getElementById("gamemode");
function renderPlayers(){
  const mode = modeSelect.value;
  const filtered = players.filter(p => mode === "All" || p.mode === mode);
  rows.innerHTML = filtered.map((p,i) => `
    <tr>
      <td><span class="rank ${i<3 ? "top-three" : ""}">#${String(i+1).padStart(2,"0")}</span></td>
      <td><div class="player-cell"><span class="avatar ${p.style}">${escapeHtml(p.avatar)}</span>${escapeHtml(p.name)}</div></td>
      <td><span class="mode-chip">${escapeHtml(p.mode)}</span></td>
      <td><span class="tier-pill ${p.tier.toLowerCase()}">${p.tier}</span></td>
      <td><span class="points">${p.points.toLocaleString("en-US")}</span></td>
    </tr>`).join("");
  document.getElementById("resultCount").textContent = `Showing ${filtered.length} player${filtered.length===1?"":"s"}`;
}
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
}
modeSelect.addEventListener("change",renderPlayers);
renderPlayers();

const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
menuToggle.addEventListener("click",()=>{
  const open = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded",String(open));
});
navLinks.querySelectorAll("a").forEach(link=>link.addEventListener("click",()=>{
  navLinks.classList.remove("open");
  menuToggle.setAttribute("aria-expanded","false");
}));
// Replace the demo Discord URL in index.html with your own invite link.
