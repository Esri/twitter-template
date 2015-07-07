define([
    "dojo/Evented",
    "dojo/parser",
    "dojo/_base/declare",
    "dojo/_base/kernel",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/dom-class",
    "dojo/Deferred",
    "dojo/promise/all",
    "esri/arcgis/utils",
    "esri/urlUtils",
    "esri/request",
    "esri/config",
    "esri/lang",
    "esri/IdentityManager",
    "esri/tasks/GeometryService",
    "templateConfig/commonConfig"

],
    function (
        Evented,
        parser,
        declare,
        kernel,
        array,
        lang,
        domClass,
        Deferred,
        all,
        arcgisUtils,
        urlUtils,
        esriRequest,
        esriConfig,
        esriLang,
        IdentityManager,
        GeometryService,
        commonConfig
    ) {
        var App =  declare("utilities.App",[Evented], {
            config: {},
            localize: false,
            orgConfig: {},
            appConfig: {},
            constructor: function (defaults, supportsLocalization) {
                //config will contain application and user defined info for the application such as i18n strings, 
                //the web map id and application id, any url parameters and any application specific configuration
                // information. 
                this.config = declare.safeMixin(defaults, commonConfig);
                this.localize = supportsLocalization || false;
                this._init().then(lang.hitch(this, function () {
                    this.emit("ready", this.config);
                }));
            },
            //Get URL parameters and set application defaults needed to query arcgis.com for
            //an application and to see if the app is running in Portal or an Org
            _init: function () {
                var deferred = new Deferred();
                //Set the web map, group and appid if they exist but ignore other url params. 
                //Additional url parameters may be defined by the application but they need to be mixed in
                //to the config object after we retrieve the application configuration info. As an example,
                //we'll mix in some commonly used url parameters in the _queryUrlParams function after
                //the application configuration has been applied so that the url parameters overwrite any
                //configured settings. It's up to the application developer to update the application to take 
                //advantage of these parameters. 
                var paramItems = ['webmap', 'appid', 'group'];
                var mixinParams = this._createUrlParamsObject(paramItems);
                lang.mixin(this.config, mixinParams);
                //Define the sharing url and other default values like the proxy. 
                //The sharing url defines where to search for the web map and application content. The
                //default value is arcgis.com. 
                this._initializeApplication();

                this._getLocalization()
                    .then(lang.hitch(this, this._queryApplicationConfiguration))
                    .then(lang.hitch(this,this._queryDisplayItem))
                    .then(lang.hitch(this,this._queryOrganizationInformation))
                    .then(lang.hitch(this, function(){

         
                        //Now that we have the org and app settings do the mixins. First overwrite the defaults 
                        //with the application settings then apply org settings if required
                        lang.mixin(this.config, this.appConfig);
                        if(this.config.queryForOrg !== false){
                            lang.mixin(this.config, this.orgConfig);
                        }
                        //Set the geometry helper service to be the app default.  
                        if (this.config.helperServices && this.config.helperServices.geometry && this.config.helperServices.geometry.url) {
                            esriConfig.defaults.geometryService = new GeometryService(this.config.helperServices.geometry.url);
                        }
                        //Now update the config with any custom url params (and the web map)
                        this._queryUrlParams();

                        //setup OAuth if oauth appid exists
                        if (this.config.oauthappid) {
                            this._setupOAuth(this.config.oauthappid, this.config.sharingurl);
                        }

                        deferred.resolve();
                    }));

                return deferred.promise;
            },
            _createUrlParamsObject: function (items) {
                //retrieve url parameters. Templates all use url parameters to determine which arcgis.com 
                //resource to work with. 
                //Map templates use the webmap param to define the webmap to display
                //Group templates use the group param to provide the id of the group to display. 
                //appid is the id of the application based on the template. We use this 
                //id to retrieve application specific configuration information. The configuration 
                //information will contain the values the  user selected on the template configuration 
                //panel.  
                var urlObject = urlUtils.urlToObject(document.location.href);
                urlObject.query = urlObject.query || {};
                var obj = {};
                if (urlObject.query && items && items.length) {
                    for (var i = 0; i < items.length; i++) {
                        if (urlObject.query[items[i]]) {
                            obj[items[i]] = urlObject.query[items[i]];
                        }
                    }
                }
                return obj;
            },

            _initializeApplication: function () {
       
                //Check to see if the app is hosted or a portal. If the app is hosted or a portal set the
                // sharing url and the proxy. Otherwise use the sharing url set it to arcgis.com. 
                //We know app is hosted (or portal) if it has /apps/ or /home/ in the url. 
                var appLocation = location.pathname.indexOf("/apps/");
                if (appLocation === -1) {
                    appLocation = location.pathname.indexOf("/home/");
                }
                //app is hosted and no sharing url is defined so let's figure it out. 
                if (appLocation !== -1) {
                    //hosted or portal
                    var instance = location.pathname.substr(0, appLocation); //get the portal instance name
                    this.config.sharingurl = location.protocol + "//" + location.host + instance;
                    this.config.proxyurl = location.protocol + "//" + location.host + instance + "/sharing/proxy";
                } 
                arcgisUtils.arcgisUrl = this.config.sharingurl + "/sharing/rest/content/items";
                //Define the proxy url for the app 
                if (this.config.proxyurl) {
                    esriConfig.defaults.io.proxyUrl = this.config.proxyurl;
                    esriConfig.defaults.io.alwaysUseProxy = false;
                }

                //check sign-in status 
                IdentityManager.checkSignInStatus(this.config.sharingurl + "/sharing").then(lang.hitch(this,
                    function (credential) {
                        return;
                    },
                    function (error) {
                        return;
                    })
                );

            },

            _getLocalization: function () {
                var deferred = new Deferred();
                if (this.localize) {
                    require(["dojo/i18n!esriTemplate/nls/template"], lang.hitch(this, function (appBundle) {
                        //Get the localization strings for the template and store in an i18n variable. Also determine if the 
                        //application is in a right-to-left language like Arabic or Hebrew. 
                        this.config.i18n = appBundle || {};
                        //Bi-directional language support added to support right-to-left languages like Arabic and Hebrew
                        //Note: The map must stay ltr  
                        this.config.i18n.direction = "ltr";
                        array.some(["ar", "he"], lang.hitch(this, function (l) {
                            if (kernel.locale.indexOf(l) !== -1) {
                                this.config.i18n.direction = "rtl";
                                return true;
                            } else {
                                return false;
                            }
                        }));
                        //add a dir attribute to the html tag. Then you can add special css classes for rtl languages
                        var dirNode = document.getElementsByTagName("html")[0];
                        var classes = dirNode.className;
                        if (this.config.i18n.direction === "rtl") {
                            //need to add support for dj_rtl. 
                            //if the dir node is set when the app loads dojo will handle. 
                            dirNode.setAttribute("dir", "rtl");
                            var rtlClasses = " esriRTL dj_rtl dijitRtl " + classes.replace(/ /g, "-rtl ");
                            dirNode.className = lang.trim(classes + rtlClasses);
                        } else {
                            dirNode.setAttribute("dir", "ltr");
                            domClass.add(dirNode, "esriLTR");
                        }
                        deferred.resolve(this.config.i18n);
                    }));
                } else {
                    deferred.resolve();
                }
                return deferred.promise;
            },
            _queryDisplayItem: function () {
                //Get details about the specified web map or group. If the group or web map is not shared publicly users will
                //be prompted to log-in by the Identity Manager.
                var deferred = new Deferred();
                if (this.config.webmap || this.config.group) {
                    var itemId = this.config.webmap || this.config.group;
                    arcgisUtils.getItem(itemId).then(lang.hitch(this, function (itemInfo) {
                        //ArcGIS.com allows you to set an application extent on the application item. Overwrite the 
                        //existing web map extent with the application item extent when set. 
                        if (this.config.appid && this.config.application_extent.length > 0 && itemInfo.item.extent) {
                            itemInfo.item.extent = [
                                [
                                    parseFloat(this.config.application_extent[0][0]),
                                    parseFloat(this.config.application_extent[0][1])
                                ],
                                [
                                    parseFloat(this.config.application_extent[1][0]),
                                    parseFloat(this.config.application_extent[1][1])
                                ]
                            ];
                        }
                        //Set the itemInfo config option. This can be used when calling createMap instead of the webmap or group id 
                        this.config.itemInfo = itemInfo;
                        deferred.resolve();
                    }));
                } else {
                    deferred.resolve();
                }
                return deferred.promise;
            },
            _queryApplicationConfiguration: function () {
                //Get the application configuration details using the application id. When the response contains
                //itemData.values then we know the app contains configuration information. We'll use these values
                //to overwrite the application defaults.

                var deferred = new Deferred();
                if (this.config.appid) {
                    arcgisUtils.getItem(this.config.appid).then(lang.hitch(this, function (response) {
                        if (response.item && response.itemData && response.itemData.values) {
                            //get app config values - we'll merge them with config later. 
                            this.appConfig = response.itemData.values;

                            //Get the web map from the app values. But if there's a web url
                            //parameter don't overwrite with the app value. 
                            var webmapParam = this._createUrlParamsObject(["webmap"]);
                            if(!esriLang.isDefined(webmapParam.webmap) && response.itemData.values.webmap && this.config.webmap){
                                this.config.webmap = response.itemData.values.webmap;
                            }
                        }
                          // get any app proxies defined on the application item
                          if (response.item && response.item.appProxies) {
                            var layerMixins = array.map(response.item.appProxies, function (p) {
                              return {
                                "url": p.sourceUrl,
                                "mixin": {
                                  "url": p.proxyUrl
                                }
                              };
                            });
                            this.config.layerMixins = layerMixins;
                          }

                        //get the extent for the application item. This can be used to override the default web map extent
                        if (response.item && response.item.extent) {
                            this.config.application_extent = response.item.extent;
                        }
                        deferred.resolve();
                    }));
                } else {
                    deferred.resolve();
                }
                return deferred.promise;
            },
            _queryOrganizationInformation: function () {
                var deferred = new Deferred();
                //Query the ArcGIS.com organization. This is defined by the sharingurl that is specified. For example if you 
                //are a member of an org you'll want to set the sharingurl to be http://<your org name>.arcgis.com. We query 
                //the organization by making a self request to the org url which returns details specific to that organization. 
                //Examples of the type of information returned are custom roles, units settings, helper services and more. 

                esriRequest({
                    url: this.config.sharingurl + "/sharing/rest/portals/self",
                    content: {
                        "f": "json"
                    },
                    callbackParamName: "callback"
                }).then(lang.hitch(this, function (response) {
                    //get units defined by the org or the org user
                    this.orgConfig.units = "metric";
                    if (response.user && response.user.units) { //user defined units
                        this.orgConfig.units = response.user.units;
                    } else if (response.units) { //org level units 
                        this.orgConfig.units = response.units;
                    } else if ((response.user && response.user.region && response.user.region === "US") || (response.user && !response.user.region && response.region === "US") || (response.user && !response.user.region && !response.region) || (!response.user && response.ipCntryCode === "US") || (!response.user && !response.ipCntryCode && kernel.locale === "en-us")){
                        // use feet/miles only for the US and if nothing is set for a user
                        this.orgConfig.units = "english";
                    }
                    //Get the helper servcies (routing, print, locator etc)
                    this.orgConfig.helperServices = {};
                    lang.mixin(this.orgConfig.helperServices, response.helperServices);



                    //are any custom roles defined in the organization? 
                    if(response.user && esriLang.isDefined(response.user.roleId)){
                        if(response.user.privileges){
                          this.orgConfig.userPrivileges = response.user.privileges;
                        }
                    }

            
                    deferred.resolve();
                }), function (error) {
                    console.log(error);
                    deferred.resolve();
                });
                return deferred.promise;
            },


            _queryUrlParams: function () {
                //This function demonstrates how to handle additional custom url parameters. For example 
                //if you want users to be able to specify lat/lon coordinates that define the map's center or 
                //specify an alternate basemap via a url parameter. 
                //If these options are also configurable these updates need to be added after any 
                //application default and configuration info has been applied. Currently these values 
                //(center, basemap, theme) are only here as examples and can be removed if you don't plan on 
                //supporting additional url parameters in your application. 
                var paramItems = ['theme','center','basemap'];
                var mixinParams = this._createUrlParamsObject(paramItems);
                lang.mixin(this.config, mixinParams);
            }
        });
    return App;
    });