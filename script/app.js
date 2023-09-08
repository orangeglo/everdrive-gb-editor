/*
  EverDrive GB Theme Editor
*/


// all the version and offset stuff applies only to the x-series carts
const CV = "v6"
const OFFSETS = {
  v4: [
    { id: 1, offset: 0x1F77 },
    { id: 2, offset: 0x1F79 },
    { id: 3, offset: 0x1F7B },
    { id: 4, offset: 0x1F7D }
  ],
  v5: [
    { id: 1, offset: 0x1F99 },
    { id: 2, offset: 0x1F9B },
    { id: 3, offset: 0x1F9D },
    { id: 4, offset: 0x1F9F }
  ],
  v6: [
    { id: 1, offset: 0x1FA4 },
    { id: 2, offset: 0x1FA6 },
    { id: 3, offset: 0x1FA8 },
    { id: 4, offset: 0x1FAA }
  ]
}

const offsetByVersionId = (version, id) => {
  return OFFSETS[version].find(obj => obj.id == id).offset;
};

const DEFAULT_PALETTES = [
  { id: 1, label: 'Background', value: 0x0000, hex: '#000000', valAddr: offsetByVersionId(CV, 1), oldValAddr: 0x6537 },
  { id: 2, label: 'Unselected ROM, Selected Menu Entry', value: 0xE413, hex: '#21FF21', valAddr: offsetByVersionId(CV, 2), oldValAddr: 0x6539 },
  { id: 3, label: 'Menu BG, Header/Footer BG', value: 0xEF3D, hex: '#7B7B7B', valAddr: offsetByVersionId(CV, 3), oldValAddr: 0x653B },
  { id: 4, label: 'Selected ROM, Header/Footer Text, Menu Entry', value: 0xFF7F, hex: '#FFFFFF', valAddr: offsetByVersionId(CV, 4), oldValAddr: 0x653D },
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
        ctx.fillRect(8*m, 32*m, (160-16)*m, (144-64) * m);
        ctx.fillStyle = this.headerFooterSelectedRomText;
        write("Game Menu", 51, 39)
        write("_____________________", 10, 42)

        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(29.5*m, 47.5*m, 108.5*m, 9*m)
        ctx.fillStyle = this.unselectedROM;

        const ySpacing = 16
        write("Select And Start", 31, 54);

        ctx.fillStyle = this.headerFooterSelectedRomText;
        write("Select Only", 44, 54+ySpacing);
        write("Cheats", 64, 54+ySpacing*2);
        write("Rom Info", 56, 54+ySpacing*3);
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
    model: 'xseries'
  },
  created() {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.has('t')) {
      for (const [key, value] of urlParams) {
        if (key === 't') { this.loadFromUrlTag(value); }
      }
      this.loadSettingsFromStorage();
    } else {
      this.loadFromStorage();
    }
    this.buildPatch();
  },
  watch: {
    model: function() {
      this.buildPatch();
    }
  },
  computed: {
    downloadEnabled: function() {
      return this.palettes.every(p => p.hex.length === 7);
    },
    filename: function() {
      if (this.model == 'xseries'){
        return 'everdrive_gbx_v06_theme_patch.ips';
      } else {
        return 'everdrive_gb_v4_theme_patch.ips';
      }
    }
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
        const addr = this.model == 'xseries' ? palette.valAddr : palette.oldValAddr

        chunks.push(0); // 3 byte offset
        chunks.push(addr >>> 8);
        chunks.push(addr & 0xFF);
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
      localStorage.setItem('gb_model', this.model);
    },
    loadFromStorage: function() {
      const palettesJson = localStorage.getItem('gb_palettes');
      if (palettesJson) {
        const palettes = JSON.parse(palettesJson);
        this.palettes.forEach(palette => {
          const loadedPalette = palettes.find(p => p.id === palette.id);
          palette.hex = loadedPalette.hex;
          palette.value = loadedPalette.value;
        });
      }
      this.loadSettingsFromStorage();
    },
    loadSettingsFromStorage: function() {
      const model = localStorage.getItem('gb_model');
      if (model) { this.model = model; }
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
      const byteArrayToHexString = (arr) => {
        // make a new array so that we support typed arrays as input, which normally can't map to strings
        return Array.from(arr).map(h => h.toString(16).padStart(2, '0')).join('').toUpperCase();
      }

      const buffer = new Uint8Array(ipsArrayBuffer).slice(5, ipsArrayBuffer.byteLength - 3);
      const data = [];

      let state = 'offset';
      let index = 0;
      let temp = {};
      while (index < buffer.length) {
        if (state === 'offset') {
          const o = buffer.slice(index + 1, index + 3);
          temp.offset = byteArrayToHexString(o);
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

        return `#${byteArrayToHexString([r + rError, g + gError, b + bError])}`;
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

      const offsetToString = (offset) => {
        return offset.toString(16).toUpperCase();
      }

      Object.keys(OFFSETS).sort().forEach(version => {
        valToState[offsetToString(offsetByVersionId(version, 1))] = valueFunctionFor(1);
        valToState[offsetToString(offsetByVersionId(version, 2))] = valueFunctionFor(2);
        valToState[offsetToString(offsetByVersionId(version, 3))] = valueFunctionFor(3);
        valToState[offsetToString(offsetByVersionId(version, 4))] = valueFunctionFor(4);
      });

      // old everdrive offsets
      valToState["6537"] = valueFunctionFor(1);
      valToState["6539"] = valueFunctionFor(2);
      valToState["653B"] = valueFunctionFor(3);
      valToState["653D"] = valueFunctionFor(4);

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
