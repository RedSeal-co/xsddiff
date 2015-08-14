/// <reference path="../typings/bluebird/bluebird.d.ts"/>
/// <reference path="../typings/chalk/chalk.d.ts"/>
/// <reference path="../typings/commander/commander.d.ts"/>
/// <reference path="../typings/deep-diff/deep-diff.d.ts"/>
/// <reference path="../typings/json-stable-stringify/json-stable-stringify.d.ts"/>
/// <reference path="../typings/lodash/lodash.d.ts"/>
/// <reference path="../typings/node/node.d.ts"/>
/// <reference path="../typings/xml2js/xml2js.d.ts"/>
'use strict';
require('source-map-support').install();
var _ = require('lodash');
var assert = require('assert');
var chalk = require('chalk');
var commander = require('commander');
var deepDiff = require('deep-diff');
var fs = require('fs');
var jsonStableStringify = require('json-stable-stringify');
var P = require('bluebird');
var xml2js = require('xml2js');
// Override the default program description.
commander.usage('old.xml new.xml\n\n' +
    '  Outputs the difference between two XML files.\n' +
    '  Exactly two XML files must be specified.');
// ### xsdDecoders
// Table of decoders for each type of XSD element.
var xsdDecoders;
// ### xsdDecodeObject
// Convert the XSD object representation by recursively decoding each property.
function xsdDecodeObject(xsdType) {
    var jsonType = _.mapValues(xsdType, function (child, key) {
        var decoder = xsdDecoders[key];
        return decoder ? decoder(child) : xsdDecode(child);
    });
    return jsonType;
}
// ### xsdDecodeArray
// Recursively decode an XSD array representation.
function xsdDecodeArray(xsdType) {
    return xsdType.map(xsdDecode);
}
// ### xsdDecode
// Converts the XSD JSON representation into a JSON object that is more suited to diff.
function xsdDecode(xsdType) {
    if (_.isArray(xsdType)) {
        return xsdDecodeArray(xsdType);
    }
    else if (!_.isObject(xsdType)) {
        return xsdType;
    }
    else {
        return xsdDecodeObject(xsdType);
    }
}
// ### makeNamespace
// Converts the XSD JSON representation of a list into a JSON object representing a namespace.
// The 'name' property of each object in the list is used for the keys of the JSON object.
var makeNamespace = function (xsdList) {
    if (!xsdList) {
        return undefined;
    }
    var jsonNamespace = {};
    _.forEach(xsdList, function (xsdElem) {
        var name = '';
        var $ = xsdElem.$;
        if ($) {
            name = $.name;
        }
        assert(!(name in jsonNamespace));
        jsonNamespace[name] = xsdDecode(xsdElem);
    });
    return jsonNamespace;
};
// List of elements that we will decode in a special way.
xsdDecoders = {
    'xsd:element': makeNamespace,
    'xsd:attribute': makeNamespace,
    'xsd:complexType': makeNamespace,
    'xsd:simpleType': makeNamespace
};
// ### makeSchema
// Converts the XSD JSON representation into a schema JSON object that is more suited to diff.
var makeSchema = function (xsdJson) {
    var schema = xsdDecode(xsdJson);
    return schema;
};
var diffCompare = function (a, b) {
    // Compares two keys from a deep-diff object.
    var order = ['kind', 'path', 'index', 'item', 'lhs', 'rhs'];
    var aIndex = order.indexOf(a.key);
    var bIndex = order.indexOf(b.key);
    if (aIndex < 0 && bIndex < 0) {
        return a.key.localeCompare(b.key);
    }
    else if (aIndex < 0) {
        return +1;
    }
    else if (bIndex < 0) {
        return -1;
    }
    else {
        return aIndex - bIndex;
    }
};
// ### makePrettyPath
// Transforms the path from a single raw diff from deep-diff from an array to a string.
var makePrettyPath = function (rawPath) {
    assert(_.isArray(rawPath));
    return rawPath.join('/');
};
// ### makePrettyDiff
// Transform the result of deep-diff into something we're not ashamed of.
function makePrettyDiff(rawDiff) {
    // Transforms a single raw diff from deep-diff to make it more presentable.
    // Transform certain keys.
    var prettyKeys = {
        path: makePrettyPath,
        item: makePrettyDiff
    };
    // We know we'll end up with a PrettyDiff, because we're transforming each field appropriately, so we reinterpret
    // cast.
    var prettyDiff = _.mapValues(rawDiff, function (rawValue, key) {
        var makePretty = prettyKeys[key];
        return makePretty ? makePretty(rawValue) : rawValue;
    });
    return prettyDiff;
}
function makePrettyDiffs(rawDiffs) {
    // Transforms the raw output of deep-diff to make it more presentable.
    return _.map(rawDiffs, makePrettyDiff);
}
var writeP = P.promisify(process.stdout.write, process.stdout);
function main(args) {
    // Create a UTF-8 file reader.
    function readFileUtf8(fileName, callback) {
        fs.readFile(fileName, 'utf8', callback);
    }
    ;
    // Create a P-compatible version of the UTF-8 file reader.
    var readFileP = P.promisify(readFileUtf8);
    // Create a P-compatible version of xml2js.parseString.
    var parseStringP = P.promisify(xml2js.parseString);
    // Read both files.
    return P.all(args.map(function (xml) { return readFileP(xml); }))
        .then(function (xml) { return P.all(_.map(xml, function (xml) { return parseStringP(xml); })); })
        .then(function (json) { return _.map(json, function (json) { return makeSchema(json); }); })
        .spread(function (json1, json2) { return deepDiff.diff(json1, json2); })
        .then(function (rawDiffs) { return makePrettyDiffs(rawDiffs); })
        .then(function (diffJson) {
        // Convert JSON to a string.
        var opts = {
            space: 2,
            cmp: diffCompare
        };
        var diffString = jsonStableStringify(diffJson, opts);
        // Write to stdout.
        return writeP(diffString);
    })
        .catch(function (err) {
        var error = chalk.bold.red;
        console.error(error('xsddiff: %s\nTrace:\n%s'), err.toString(), err.stack);
        process.exit(1);
    });
}
// Parse command line arguments.
commander.parse(process.argv);
if (commander.args.length !== 2) {
    commander.help();
}
else {
    main(commander.args);
}
//# sourceMappingURL=xsddiff.js.map