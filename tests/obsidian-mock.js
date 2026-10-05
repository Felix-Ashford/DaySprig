class Component {
	registerEvent() {}
	registerInterval() {}
	registerDomEvent() {}
}
class Events extends Component {
	on() { return {}; }
	trigger() {}
}
class Plugin extends Component {
	constructor(app, manifest) { super(); this.app = app; this.manifest = manifest; }
	addCommand() {}
	addRibbonIcon() {}
}
class Modal extends Component { constructor(app) { super(); this.app = app; } }
class Setting { constructor() {} }
class Menu { addItem() { return this; } addSeparator() { return this; } showAtMouseEvent() {} }
class TFile {}
module.exports = {
	Component, Events, Plugin, Modal, Setting, Menu, TFile,
	Notice: class Notice { constructor(message) { this.message = message; } },
	setIcon() {},
};
