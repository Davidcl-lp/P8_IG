import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { tsvParse } from "d3-dsv";

const minLon = -15.8402;
const maxLon = -15.3562;
const minLat = 27.7303;
const maxLat = 28.1828;

const municipios = {
  "Agaete": { lat: 28.100, lon: -15.700 },
  "Agüimes": { lat: 27.905, lon: -15.450 },
  "Artenara": { lat: 28.020, lon: -15.650 },
  "Arucas": { lat: 28.120, lon: -15.520 },
  "Firgas": { lat: 28.100, lon: -15.550 },
  "Gáldar": { lat: 28.150, lon: -15.650 },
  "Ingenio": { lat: 27.930, lon: -15.430 },
  "La Aldea de San Nicolás": { lat: 27.982132, lon: -15.778562 }, 
  "Las Palmas de Gran Canaria": { lat: 28.123, lon: -15.436 },
  "Mogán": { lat: 27.840, lon: -15.740 },
  "Moya": { lat: 28.050, lon: -15.550 },
  "San Bartolomé de Tirajana": { lat: 27.800, lon: -15.550 },
  "Santa Brígida": { lat: 28.050, lon: -15.450 },
  "Santa Lucía de Tirajana": { lat: 27.910, lon: -15.500 },
  "Tejeda": { lat: 28.020, lon: -15.583 },
  "Telde": { lat: 27.992, lon: -15.405 },
  "Valsequillo de Gran Canaria": { lat: 28.039, lon: -15.483 },
  "Vega de San Mateo": { lat: 28.030, lon: -15.533 },
};


function project(lat, lon, mapWidth, mapHeight) {
  const x = ((lon - minLon) / (maxLon - minLon)) * mapWidth - mapWidth / 2;
  const y = ((lat - minLat) / (maxLat - minLat)) * mapHeight - mapHeight / 2;
  return { x, y };
}


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, -300, 600);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const textureLoader = new THREE.TextureLoader();
const mapTexture = textureLoader.load("/mapa_gran_canaria.png", () => {
  mapTexture.minFilter = THREE.LinearFilter;

  const mapWidth = 1942;
  const mapHeight = 2046;

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(mapWidth, mapHeight),
    new THREE.MeshBasicMaterial({ map: mapTexture })
  );
  scene.add(plane);

  loadTSV(mapWidth, mapHeight);
});


const yearCanvas = document.createElement("canvas");
yearCanvas.width = 400;
yearCanvas.height = 200;
const yearCtx = yearCanvas.getContext("2d");

const yearTexture = new THREE.CanvasTexture(yearCanvas);
yearTexture.needsUpdate = true;

const yearMaterial = new THREE.SpriteMaterial({ map: yearTexture, transparent: true });
const yearSprite = new THREE.Sprite(yearMaterial);
yearSprite.position.set(0, 0, 50);
yearSprite.scale.set(200, 100, 1);
yearSprite.renderOrder = 2;
scene.add(yearSprite);

function updateYearSprite(year) {
  yearCtx.clearRect(0, 0, yearCanvas.width, yearCanvas.height);
  yearCtx.fillStyle = "black";
  yearCtx.font = "bold 120px Arial";
  yearCtx.textAlign = "center";
  yearCtx.textBaseline = "middle";
  yearCtx.fillText(year, yearCanvas.width / 2, yearCanvas.height / 2);
  yearTexture.needsUpdate = true;
}


let populationData = {};
let yearList = [];
let latestYear = 0;

async function loadTSV(mapWidth, mapHeight) {
  const text = await fetch("/poblacion.tsv").then(r => r.text());
  const rows = tsvParse(text);

  for (let row of rows) {
    const muni = row["TERRITORIO"];
    const year = parseInt(row["TIME_PERIOD"]);
    const value = parseInt(row["OBS_VALUE"]);

    if (!populationData[muni]) populationData[muni] = {};
    populationData[muni][year] = value;

    if (!yearList.includes(year)) yearList.push(year);
    if (year > latestYear) latestYear = year;
  }

  yearList.sort((a, b) => a - b);
  createMunicipioPoints(mapWidth, mapHeight);
}


let points = [];

function createMunicipioPoints(mapWidth, mapHeight) {
  for (let [name, coords] of Object.entries(municipios)) {
    const { x, y } = project(coords.lat, coords.lon, mapWidth, mapHeight);

 
    const geometry = new THREE.CircleGeometry(50, 32);
    const material = new THREE.MeshBasicMaterial({ color: "white" });
    const point = new THREE.Mesh(geometry, material);
    point.position.set(x, y, 5);
    point.userData.municipio = name;
    scene.add(point);
    points.push(point);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = "130px Arial";
    const textWidth = ctx.measureText(name).width;
    canvas.width = textWidth + 20;
    canvas.height = 150;

    const lastPop = populationData[name]?.[latestYear] || 0;
    ctx.fillStyle = lastPop < 6000 ? "white" : "black";
    ctx.font = "130px Arial";
    ctx.textBaseline = "top";
    ctx.fillText(name, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(canvas.width / 4, canvas.height / 4, 1);
    sprite.position.set(x, y, 20);
    sprite.renderOrder = 1;
    scene.add(sprite);
  }

  animateYears();
}


let currentYearIndex = 0;
let lastUpdate = 0;
const yearDuration = 700;

function animateYears(timestamp = 0) {
  requestAnimationFrame(animateYears);

  if (timestamp - lastUpdate > yearDuration) {
    lastUpdate = timestamp;

    const currentYear = yearList[currentYearIndex];
    updateColorsForYear(currentYear);
    updateYearSprite(currentYear);

    currentYearIndex = (currentYearIndex + 1) % yearList.length;
  }

  controls.update();
  renderer.render(scene, camera);
}


function populationToColor(pop) {
  const min = 500;
  const max = 70000;
  if (pop >= max) return new THREE.Color("red");
  const t = (pop - min) / (max - min);
  const r = Math.trunc(Math.min(255, 255 * t));
  const g = Math.trunc(Math.min(255, 255 * (1 - Math.abs(t - 0.5) * 2)));
  return new THREE.Color(`rgb(${r},${g},0)`);
}

function updateColorsForYear(year) {
  points.forEach(point => {
    const muni = point.userData.municipio;
    const pop = populationData[muni]?.[year];
    if (!pop) return;
    point.material.color.set(populationToColor(pop));
  });
}


window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
