// Simple tile-based rendering
async function load(){
const res = await fetch('landingpage_PINS2526.json', {cache:'no-store'});
return await res.json();
}


function makeTile(r){
const tile = document.createElement('article');
tile.className = 'tile';
tile.onclick = () => window.open(r.url, '_blank');


const img = document.createElement('img');
img.src = r.img || 'assets/placeholder.png';
img.alt = '';


const wrap = document.createElement('div');
wrap.className = 'tile-content';


const title = document.createElement('h3');
title.className = 'title';
title.textContent = r.title;


const desc = document.createElement('p');
desc.className = 'desc';
desc.textContent = r.description;


wrap.append(title, desc);
tile.append(img, wrap);
return tile;
}


window.addEventListener('DOMContentLoaded', async ()=>{
const data = await load();
document.getElementById('page-title').textContent = data.title;
document.getElementById('page-intro').textContent = data.intro;


const tiles = document.getElementById('tiles');
data.resources.forEach(r => tiles.appendChild(makeTile(r)));
});