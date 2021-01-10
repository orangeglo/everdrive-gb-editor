/*
0x1F77

Background / Highlight Menu Entry BG - Black 0000
ROM Entry / Highlighted Menu Entry - Green
Border BG, Highlighted ROM BG, Menu BG - Grey
Highlighted ROM Entry / Border Text - White FF7F

*/

const DEFAULT_PALETTES = [
  { id: 1, label: 'Background, Selected Menu Entry BG', value: 0x0000, hex: '#000000', valAddr: 0x1F77 },
  { id: 2, label: 'Unselected ROM, Selected Menu Entry', value: 0xE413, hex: '#21FF21', valAddr: 0x1F79 },
  { id: 3, label: 'Menu, Header/Footer, and Selected ROM BG', value: 0xEF3D, hex: '#7B7B7B', valAddr: 0x1F7B },
  { id: 4, label: 'Selected ROM, Header/Footer Text, Menu Entry', value: 0xFF7F, hex: '#FFFFFF', valAddr: 0x1F7D },
];
const IPS_HEADER = [0x50, 0x41, 0x54, 0x43, 0x48];
const IPS_EOF = [0x45, 0x4F, 0x46];

const deepClone = (arr) => {
  return arr.map(obj => Object.assign({}, obj));
}

Vue.component('live-preview', {
  props: ['palettes', 'show-menu', 'fonts-loaded'],
  computed: {
    backgroundColor: function() { return this.getStandardColor(1); },
  },
  watch: {
    palettes: {
      deep: true,
      handler: function() { this.renderCanvas(); },
    },
    fontsLoaded: function() { this.renderCanvas(); }
  },
  mounted: function() {
    this.renderCanvas();
  },
  methods: {
    getStandardColor: function(id) {
      const palette = this.palettes.find(p => p.id === id);
      return palette.overrideHex ? '#000000' : palette.hex;
    },
    renderCanvas: function() {
      const canvas = this.$refs.canvas;

      const ctx = canvas.getContext('2d');
      ctx.font = "21px ibm";

      const write = (text, x, y) => {
        if (this.fontsLoaded) { ctx.fillText(text, x*2, (y+0.5)*2); }
      }

      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, 640, 576);
      // ctx.fillStyle = this.headerFooterMenuBG;
      // ctx.fillRect(0, 0, 640, 24);
      // ctx.fillRect(0, (240-24)*2, 720, 48);

      // ctx.fillStyle = this.basicText;
      // write("Basic Text", 2, 10);

      // if (this.showMenu) {
      //   ctx.fillStyle = this.folderMenuItem;
      //   write("Selected Folder", 2, 240-13);
      // } else {
      //   write("Selected ROM", 2, 240-14);
      // }

      // for (let i = 0; i < 15; i++) {
      //   const y = i * 12 + 33;
      //   if (i === 0) {
      //     if (this.showMenu) {
      //       ctx.fillStyle = this.basicText;
      //       write("Selected Folder", 2, y);
      //     } else {
      //       ctx.fillStyle = this.folderMenuItem;
      //       write("Unselected Folder", 2, y);
      //     }
      //   } else if (i === 6 && !this.showMenu) {
      //     ctx.fillStyle = this.basicText;
      //     write("Selected ROM", 2, y);
      //   } else {
      //     ctx.fillStyle = this.unselectedROM;
      //     write("Unselected ROM", 2, y);
      //   }
      // }

      // if (this.showMenu) {
      //   ctx.fillStyle = this.headerFooterMenuBG;
      //   ctx.fillRect(68*2, 23*2, 222*2, 168*2);
      //   ctx.fillStyle = this.menuHeaderBG;
      //   ctx.fillRect(68*2, 23*2, 222*2, 12*2);
      //   ctx.fillStyle = this.menuHeaderText;
      //   write("Main Menu", 126, 33);

      //   ctx.fillStyle = this.basicText;
      //   write("Options", 138, 32+12*2);
      //   ctx.fillStyle = this.folderMenuItem;
      //   write("Recently Played", 92, 32+12*4);
      //   write("Start Random Game", 80, 32+12*6);
      //   write("Device Info", 115, 32+12*8);
      //   write("Diagnostics", 115, 32+12*10);
      //   write("About", 151, 32+12*12);
      // }
    },
  },
  template: `
    <canvas width='640' height='576' ref='canvas'></canvas>
  `
});

Vue.component('palette-entry', {
  props: ['palette'],
  template: `
    <div class='palette'>
      <label :for="'palette-' + palette.id">
        {{ palette.id }}. {{ palette.label }}
      </label>
      <div class='controls'>
        <input
          type='text'
          :value="palette.hex"
          @input="e => {
            $emit('color-changed', { value: e.target.value, id: palette.id });
          }"
          maxlength='7'
          pattern="#[0-9A-Fa-f]{6}"
          class='color-input'
        />
        <input
          :id="'palette-' + palette.id"
          type='color'
          :value="palette.hex"
          @input="e => {
            $emit('color-changed', { value: e.target.value, id: palette.id });
          }" 
        />
      </div>
    </div>
  `
});

const app = new Vue({
  el: '#app',
  data: {
    palettes: deepClone(DEFAULT_PALETTES),
    patchData: null,
    buildPatchTimeoutHandle: null,
    fontsLoaded: false,
  },
  created() {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.has('t')) {
      for (const [key, value] of urlParams) {
        if (key === 't') { this.loadFromUrlTag(value); }
      }
    } else {
      this.loadFromStorage();
    }
    this.buildPatch();
  },
  computed: {
    downloadEnabled: function() {
      return this.palettes.every(p => p.hex.length === 7);
    },
  },
  methods: {
    colorChanged: function(value, id) {
      const palette = this.palettes.find(p => p.id === id);
      palette.hex = value.toUpperCase();
      palette.value = this.hexToBGR(palette.hex);
      this.triggerBuildPatch();
    },
    hexToBGR: function(hex) {
      const r = Math.floor(parseInt(hex.slice(1, 3), 16) / 8) << 0;
      const g = Math.floor(parseInt(hex.slice(3, 5), 16) / 8) << 5;
      const b = Math.floor(parseInt(hex.slice(5, 7), 16) / 8) << 10;
      const temp = (b + g + r).toString(16).padStart(4, '0');
      return parseInt(temp.slice(2, 4) + temp.slice(0, 2), 16);
    },
    triggerBuildPatch: function() {
      if (this.buildPatchTimeoutHandle) {
        clearTimeout(this.buildPatchTimeoutHandle);
      }
      this.buildPatchTimeoutHandle = setTimeout(() => {
        this.buildPatch();
      }, 100);
    },
    buildPatch: function() {
      this.saveToStorage();
      this.updateUrlTag();
      this.buildPatchTimeoutHandle = null;

      const chunks = [];
      this.palettes.forEach(palette => {
        chunks.push(0); // 3 byte offset
        chunks.push(palette.valAddr >>> 8);
        chunks.push(palette.valAddr & 0xFF);
        chunks.push(0); // 2 byte size
        chunks.push(2);
        chunks.push(palette.value >>> 8); // 2 byte value
        chunks.push(palette.value & 0xFF);
      });

      const bytes = new Uint8Array([IPS_HEADER, chunks.flat(), IPS_EOF].flat());
      if (this.patchData) { URL.revokeObjectURL(this.patchData) }
      this.patchData = URL.createObjectURL(new Blob([bytes]));
    },
    saveToStorage: function() {
      localStorage.setItem('gb_palettes', JSON.stringify(this.palettes));
    },
    loadFromStorage: function() {
      const palettesJson = localStorage.getItem('gb_palettes');
      if (palettesJson) { this.palettes = JSON.parse(palettesJson); }
    },
    reset: function() {
      const sure = window.confirm('Are you sure you want to reset to the default colors?');
      if (sure) {
        this.palettes = deepClone(DEFAULT_PALETTES);
        this.buildPatch();
      }
    },
    loadFromUrlTag: function(tag) {
      const decoded = atob(tag).split(',');
      const b36ToHex = (b36) => `#${parseInt(b36, 36).toString(16).padStart(6, '0')}`;
      if (decoded[0] === '1') {
        for (let i = 0; i < 4; i++) {
          this.palettes[i].hex = b36ToHex(decoded[i + 1]);
          this.palettes[i].value = this.hexToBGR(this.palettes[i].hex);
        }
      }
    },
    updateUrlTag: function() {
      const palettesBase36 = this.palettes.map(p => parseInt(p.hex.slice(1,7),16).toString(36));
      const data = [1, ...palettesBase36].flat();
      const encodedData = btoa(data.join(','));
      if (encodedData !== 'MSwwLDFicjR4LDR0ZzhyLDl6bGRy') {
        history.replaceState({t: encodedData}, '', `?t=${encodedData}`);
      } else {
        history.replaceState({}, '', location.href.split('?')[0]);
      }
    },
  }
});

document.fonts.ready.then(function() { app.fontsLoaded = true;});
