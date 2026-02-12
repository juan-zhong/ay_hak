
// 简化示例数据
const results = document.getElementById("results");
const entry = document.getElementById("entry");
const q = document.getElementById("q");
const btnSearch = document.getElementById("btnSearch");

const data = [
  { word:"侬", gloss:"你（第二人称）", dialect:"福州话" },
  { word:"阿拉", gloss:"我们 / 我", dialect:"上海话" },
  { word:"你", gloss:"你（第二人称）", dialect:"粤语" }
];

function render(list){
  results.innerHTML = list.map(e=>`
    <div class="result-item">
      <div class="word">${e.word}</div>
      <p class="gloss">${e.gloss} · ${e.dialect}</p>
    </div>
  `).join("");
}

btnSearch.onclick = ()=>{
  const s = q.value.trim();
  render(data.filter(e=>e.word.includes(s) || e.gloss.includes(s)));
};

render(data);
