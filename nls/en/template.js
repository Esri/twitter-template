﻿define(
({
  viewer:{
    main:{
      scaleBarUnits: "english" //"english (for miles) or "metric" (for km) - don't translate.
    },
   sidePanel:{
   	label: "Description"
    },
    errors:{
      createMap: "Unable to create map",
      general: "Error"
    }
  },
  tools:{
    tweets: {
    "screenName": "Screen name",
    "signIn": "Sign in",
    "switchAccount": "Switch account",
    // doc about date and time patterns: http://dojotoolkit.org/reference-guide/dojo/date/locale/format.html
    // yyyy: full year, e.g. 2011
    // MMMM: full month name, e.g. December
    // d: day of month, e.g. 5 or 24 ("dd" would be 05 or 24)
    // h: hours by 0-11, e.g. 6 or 11 ("hh" would be 06 or 11)
    // a: am/pm
    // H: hours by 0-23, e.g. 6 or 23 ("HH" would be 06 or 23)
    // ss: seconds, e.g. 08 or 37 (just "s" would be 8 or 37)
    // SSS: milliseconds, e.g. 006 or 123 (just "S" would be 6 or 123)
    datePattern: "d MMM yy",
    timePattern: "h:mma",
    reply: "Reply",
    retweet:"Retweet",
    favorite:"Favorite",
    label: "Tweets",
    title: "Tweets",
    error: "No results found, try another search term or location",
		search:{
			label: "Search",
			title: "Search Twitter",
			placeholder: 'Keywords to search'
		},
		clear:{
			label: "Clear",
			title: "Clear Map"
		},
		share:{
			label: "Share Map:",
			email:{
				title: "Email",
				label: "Email"
			},
			twitter:{
				title: "Twitter",
				label: "Twitter"
			},
			facebook:{
				title: "Facebook",
				label: "Facebook"
			}
		}
	 }
   }
 })
);