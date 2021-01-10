/*
  EverDrive GB Theme Editor
*/

const DEFAULT_PALETTES = [
  { id: 1, label: 'Background', value: 0x0000, hex: '#000000', valAddr: 0x1F77 },
  { id: 2, label: 'Unselected ROM, Selected Menu Entry', value: 0xE413, hex: '#21FF21', valAddr: 0x1F79 },
  { id: 3, label: 'Menu BG, Header/Footer BG', value: 0xEF3D, hex: '#7B7B7B', valAddr: 0x1F7B },
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
    unselectedROM: function() { return this.getStandardColor(2); },
    headerFooterMenuBG: function() { return this.getStandardColor(3); },
    headerFooterSelectedRomText: function() { return this.getStandardColor(4); }
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
      ctx.font = "24px ibm";

      const m = 4;
      const write = (text, x, y) => {
        if (this.fontsLoaded) { ctx.fillText(text, x*m, (y+0.5)*m); }
      }

      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(0, 0, 160 * m, 144 * m);

      if (!this.showMenu) {
        ctx.fillStyle = this.headerFooterMenuBG;
        ctx.fillRect(0, 0, 160 * m, 8 * m);
        ctx.fillRect(0, (144-24) * m, 160 * m, 24 * m);

        ctx.fillStyle = this.headerFooterSelectedRomText;
        write("Header Text", 1.5, 6.5);
        write("Selected ROM", 1.5, 144-24+6.5);

        for (let i = 0; i < 12; i++) {
          const y = i * 8 + 22;
          if (i === 3) {
            ctx.fillStyle = this.headerFooterMenuBG;
            ctx.fillRect(0, (y-6)*m, 160*m, 8*m)
            ctx.fillStyle = this.headerFooterSelectedRomText;
            write("Selected ROM", 2, y);
          } else {
            ctx.fillStyle = this.unselectedROM;
            write("Unselected ROM", 2, y);
          }
        }
      } else {
        ctx.fillStyle = this.headerFooterMenuBG;
        ctx.fillRect(8*m, 8*m, (160-24)*m, (144-16) * m);
        ctx.fillStyle = this.headerFooterSelectedRomText;
        write("Main Menu", 45, 15)
        write("____________________", 9, 18)

        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(49.5*m, 23.5*m, 48.5*m, 9*m)
        ctx.fillStyle = this.unselectedROM;

        const ySpacing = 16
        write("Options", 51, 30);

        ctx.fillStyle = this.headerFooterSelectedRomText;
        write("Recently Played", 24, 30+ySpacing);
        write("Random Game", 38, 30+ySpacing*2);
        write("Cheats", 58, 30+ySpacing*3);
        write("Device Info", 38, 30+ySpacing*4);
        write("Diagnostics", 38, 30+ySpacing*5);
        write("About", 58, 30+ySpacing*6);
      }
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
    reset: function(confirm = true) {
      let sure = true;
      if (confirm) {
        sure = window.confirm('Are you sure you want to reset to the default colors?');
      }
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
    triggerIpsFileLabel: function() { this.$refs.ipsFileLabel.click(); },
    uploadIPS: async function(e) {
      const fileReader = new FileReader()
      fileReader.onload = () => {
        this.parseIPS(fileReader.result);
      }
      fileReader.readAsArrayBuffer(e.target.files[0]);
      e.target.value = '';
    },
    parseIPS: async function(ipsArrayBuffer) {
      const buffer = new Uint8Array(ipsArrayBuffer).slice(5, ipsArrayBuffer.byteLength - 3);
      const data = [];

      let state = 'offset';
      let index = 0;
      let temp = {};
      while (index < buffer.length) {
        if (state === 'offset') {
          const o = buffer.slice(index, index + 3);
          const offsetStr = parseInt(`${o[0].toString(16)}${o[1].toString(16)}${o[2].toString(16)}`, 16);
          temp.offset = offsetStr.toString(16).toUpperCase();
          index += 4;
          state = 'length';
        } else if (state === 'length') {
          temp.length = buffer[index];
          index++;
          state = 'value';
        } else { // state === 'value'
          const v = buffer.slice(index, index + temp.length);
          let stringValue = '';
          v.forEach(val => stringValue += val.toString(16).padStart(2, '0'));
          temp.value = parseInt(stringValue, 16);
          index += temp.length;
          data.push(temp);
          temp = {};
          state = 'offset';
        }
      }

      const bgrToHex = bgr => {
        const bgrStr = bgr.toString(16).padStart(4, '0');
        let bgrInt = parseInt(bgrStr.slice(2, 4) + bgrStr.slice(0, 2), 16);
        bgrInt = Math.min(bgrInt, Math.pow(2, 15) - 1); // limit to 15-bit

        const r = (bgrInt & 0b11111) * 8;
        const g = ((bgrInt >>> 5) & 0b11111) * 8;
        const b = ((bgrInt >>> 10) & 0b11111) * 8;
        const rError = Math.floor(r / 32);
        const gError = Math.floor(g / 32);
        const bError = Math.floor(b / 32);

        return '#' + (
          (r + rError).toString(16).padStart(2, '0') +
          (g + gError).toString(16).padStart(2, '0') +
          (b + bError).toString(16).padStart(2, '0')
        ).toUpperCase();
      }

      const valToState = {};
      const valueFunctionFor = (id) => {
        return (val) => {
          let pal = null;
          pal = this.palettes.find(p => p.id === id);
          pal.value = val;
          pal.hex = bgrToHex(val);
        };
      };

      valToState['1F77'] = valueFunctionFor(1);
      valToState['1F79'] = valueFunctionFor(2);
      valToState['1F7B'] = valueFunctionFor(3);
      valToState['1F7D'] = valueFunctionFor(4);

      this.reset(false);
      data.forEach(d => {
        const f = valToState[d.offset];
        if (f) { f(d.value); }
      });
      this.buildPatch();
    },
  }
});

document.fonts.ready.then(function() { app.fontsLoaded = true;});
