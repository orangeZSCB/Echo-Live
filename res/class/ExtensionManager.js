/**
 * 针对一个特定页面的插件钩子，用于安装和卸载插件的脚本和样式。
 * 
 * 标准格式如下：
 * 
 * ```json
 * {
 *     "styles": [
 *         "style.css"
 *     ],
 *     "scripts": [
 *         "script.js"
 *     ]
 * }
 * ```
 */
class AddonHook {
    /**
     * `AddonHook` 的构造方法。
     * 
     * @param {{ styles: string[] | undefined, scripts: string[] | undefined }} meta 扩展钩子的元数据
     * @param {string} root 扩展的根目录
     */
    constructor(meta, root) {
        this.root = root;

        this.styles = meta.styles ?? [];
        this.scripts = meta.scripts ?? [];

        this.loadedElements = [];
    }

    /**
     * 在当前页面加载插件钩子。
     */
    load() {
        this.styles.forEach(s => this._loadStyle(s));
        this.scripts.forEach(s => this._loadScript(s));
    }

    /**
     * 卸载当前页面的插件钩子。（不能保证有效）
     */
    unload() {
        this.loadedElements.forEach(e => e.remove());
        this.loadedElements = [];
    }

    _loadStyle(url) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = this.root + url;

        document.head.appendChild(link);
        this.loadedElements.push(link);
        return link;
    }

    _loadScript(url) {
        const script = document.createElement("script");
        script.src = this.root + url;

        document.body.appendChild(script);
        this.loadedElements.push(script);
        return script;
    }

    /**
     * 为方便格式化 `LocalStorage` 中的 `Extension` 列表而创建的方法。
     * @returns 用于 `JSON.stringfy` 的 `object`
     */
    toObject() {
        return {
            "styles": this.styles,
            "scripts": this.scripts
        }
    }
}


/**
 * 插件。
 * 
 * 标准格式如下：
 * 
 * ```json
 * {
 *     "name": "addon-name",
 *     "title": "插件名称",
 *     "description": "这是一个插件的描述",
 *     "live": ...,// 在 live 页面挂载的插件钩子
 *     "editor": ...,// 在 editor 页面挂载的插件钩子
 *     "history": ...,// 在 history 页面挂载的插件钩子
 *     "settings": ...,// 在 settings 页面挂载的插件钩子
 *     "requirements": "namespace:addon-name>=1.0.0"// 目前还没有在这里进行硬性规定
 * }
 * ```
 */
class Addon {
    constructor(meta, root) {
        this.root = root;

        if (meta?.name == undefined) {
            throw Error();
        }

        this.name = meta.name;
        this.title = meta.title ?? meta.name;
        this.description = meta.description ?? "";

        this.requirements = meta.requirements ?? [];

        this.editorHook = new AddonHook(meta.editor ?? {}, root);
        this.liveHook = new AddonHook(meta.live ?? {}, root);
        this.settingsHook = new AddonHook(meta.settingsHook ?? {}, root);
        this.historyHook = new AddonHook(meta.history ?? {}, root);

        this.globalHook = new AddonHook(meta.addonHook ?? {}, root);
    }

    enable() {
        if (!config.global.theme_script_enable) {
            throw Error("由于配置中禁止使用脚本，因此无法启动这个插件");
        }

        this.globalHook.load();
        this.hookOfThisPage()?.load();
    }

    disable() {
        this.globalHook.unload();
        this.hookOfThisPage()?.unload();
    }

    hookOfThisPage() {
        if (thisPage == "history") {
            return this.historyHook;
        }

        if (thisPage == "editor") {
            return this.editorHook;
        }

        if (thisPage == "settings") {
            return this.settingsHook;
        }

        if (thisPage == "live") {
            return this.liveHook;
        }
        
        return;
    }

    toObject() {
        return {
            "name": this.name,
            "title": this.title,
            "description": this.description,
            "live": this.liveHook.toObject(),
            "editor": this.editorHook.toObject(),
            "history": this.historyHook.toObject(),
            "settings": this.settingsHook.toObject(),
            "requirements": this.requirements
        }
    }
}


/**
 * 主题。
 * 
 * 标准格式如下：
 * 
 * ```json
 * {
 *     "name": "theme-name",
 *     "title": "主题名字",
 *     "description": "这是一个主题的描述",
 *     "style": "style.css",
 * }
 * ```
 */
class Theme {
    constructor(meta, root) {
        if (meta?.name == undefined) throw Error("主题初始化时出现了错误，因为该主题缺少了名称");
        if (meta?.style == undefined) throw Error("主题初始化时出现了错误，因为该主题缺少了 style");

        this.root = root;

        this.name = meta.name;
        this.title = meta.title ?? meta.name;
        this.description = meta.description ?? "";
        this.style = meta.style;
    }

    toObject() {
        return {
            "name": this.name,
            "title": this.title,
            "description": this.description,
            "style": this.style
        }
    }

    load() {
        document.getElementById("echo-live-theme").href = this.root + this.style;
    }
}


/**
 * 扩展包。
 * 
 * 标准格式如下：
 * 
 * ```json
 * {
 *     "meta": {
 *         "namespace": "extension-namespace",
 *         "author": "Extension Author",
 *         "version": "0.0.1",
 *         "url": "..."    // 可以留空
 *     },
 *     "addons": [ ... ],
 *     "themes": [ ... ],
 *     "audio": [ {
 *         "name": "audioName",
 *         "path": [
 *             "audioPath"
 *         ]
 *     } ]
 * }
 * ```
 */
class Extension {
    constructor(data) {
        this.addons = [];
        this.themes = [];

        if (data?.meta == undefined) throw Error();
        if (data.meta?.namespace == undefined) throw Error();

        this.namespace = data.meta.namespace;
        this.author = data.meta.author ?? "";
        this.version = data.meta.version ?? "";
        this.url = data.meta.url ?? "";

        data?.addons?.forEach?.(addon => {
            if (typeof addon != 'object') return;
            if (addon.name == undefined) return;

            var root;

            if (this.namespace == "echo-live") {
                root = "res/";
            } else {
                root = "extensions/" + this.namespace + "/";
            }

            this.addons.push(new Addon(addon, root));
        });

        data?.themes?.forEach?.(theme => {
            if (typeof theme != 'object') return;
            if (theme.name == undefined) return;
            if (theme.style == undefined) return;

            var root;

            if (this.namespace == "echo-live") {
                root = "res/";
            } else {
                root = "packs/" + this.namespace + "/";
            }

            this.themes.push(new Theme(theme, root));
        });
    }

    toObject() {
        return {
            "meta": {
                "namespace": this.namespace,
                "author": this.author,
                "version": this.version,
                "url": this.url
            },
            "addons": this.addons.map(addon => addon.toObject()),
            "themes": this.themes.map(theme => theme.toObject())
        }
    }

    /**
     * 在当前 Extension 命名空间内查找插件。
     * @param {string} name 插件的名字。
     * @returns 插件。如果没有找到就返回 `undefined`。
     */
    getAddonByName(name) {
        for (let i = 0; i < this.addons.length; i++) {
            if (this.addons[i].name == name) {
                return this.addons[i];
            }
        }

        return;
    }

    getThemeByName(name) {
        for (let i = 0; i < this.themes.length; i++) {
            if (this.themes[i].name == name) {
                return this.themes[i];
            }
        }

        return;
    }
}


class ExtensionManager {
    constructor() {
        this.extensions = [];
        this.enabledAddons = [];

        this.loadLocalStorage();
    }

    load(data = {}) {
        if (data?.meta == undefined) return;
        if (data.meta?.namespace == undefined) return;
        if (this.getExtensionByNamespace(data.meta.namespace) != undefined) return;

        var extension = new Extension(data);
        this.extensions.push(extension);

        return extension;
    }

    loadLocalStorage() {
        const localStorageManager = new LocalStorageManager();
        var extensions = localStorageManager.getItem("extensions");
        var enabledAddons = localStorageManager.getItem("enabledAddons");

        if (!Array.isArray(extensions)) {
            this.saveLocalStorage();
            return;
        }

        extensions.forEach(extension => {
            this.load(extension);
        });
        this.enabledAddons = enabledAddons;
    }

    /**
     * 获得对应的 Addon
     * @param {string} name 插件的名称，符合 `命名空间:插件名` 的格式
     * @returns 插件，如果没有找到则返回 `undefined`。
     */
    getAddonByName(name) {
        if (name.split(":").length == 1) {
            return this.getExtensionByNamespace("echo-live").getAddonByName(name);
        }

        if (name.split(":").length != 2) {
            return;
        }

        for (let i = 0; i < this.extensions.length; i++) {
            if (this.extensions[i].namespace != name.split(":")[0]) continue;

            const addon = this.extensions[i].getAddonByName(name.split(":")[1]);

            if (addon) {
                return addon;
            }
        }

        return;
    }

    getThemeByName(name) {
        if (name.split(":").length == 1) {
            return this.getExtensionByNamespace("echo-live").getThemeByName(name);
        }

        if (name.split(":").length != 2) {
            return;
        }

        for (let i = 0; i < this.extensions.length; i++) {
            if (this.extensions[i].namespace != name.split(":")[0]) continue;

            const theme = this.extensions[i].getThemeByName(name.split(":")[1]);

            if (theme) {
                return theme;
            }
        }

        return;
    }

    /**
     * 刷新 `enabledAddonsList` 列表，清除不存在的插件。
     */
    refreshEnabledAddonsList() {
        this.enabledAddons = this.enabledAddons.filter(a => this.getAddonByName(a) != undefined);
    }

    saveLocalStorage() {
        this.refreshEnabledAddonsList();

        const localStorageManager = new LocalStorageManager();
        localStorageManager.setItem("extensions", this.extensions.map(
            extension => extension.toObject()
        ));
        localStorageManager.setItem("enabledAddons", this.enabledAddons);
    }

    getExtensionByNamespace(namespace) {
        for (let i = 0; i < this.extensions.length; i++) {
            if (this.extensions[i].namespace == namespace) {
                return this.extensions[i];
            }
        }

        return;
    }

    removeExtensionByNamespace(namespace) {
        this.extensions.filter(e => e.namespace == namespace).forEach(extension => {
            extension.addons.forEach(addon => {
                addon.disable();
            });
        });

        this.extensions = this.extensions.filter(e => e.namespace != namespace);
        this.saveLocalStorage();
    }

    enableAddons() {
        this.enabledAddons.forEach(a => this.getAddonByName(a).enable());
    }

    loadTheme(name = "vanilla") {
        var theme = this.getThemeByName(name) ?? this.getThemeByName("vanilla");

        theme.load();
        return theme;
    }

    themes() {
        return this.extensions.map(e => e.themes).flat();
    }

    addAddon(name) {
        this.enableAddons.push(name);
        this.refreshEnabledAddonsList();
    }

    removeAddon(name) {
        this.enableAddons = this.enableAddons.filter(a => a != name);
        this.refreshEnabledAddonsList();
    }
}

let extensionManager = new ExtensionManager();

if (config.global.theme_script_enable) {
    extensionManager.enableAddons();
} else {
    console.warn("配置文件中未允许允许外置脚本，因此所有的 Addons 都没有被启动。")
}
