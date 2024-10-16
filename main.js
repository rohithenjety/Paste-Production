var LZString = {
    _f: String.fromCharCode,
    _keyStrBase64: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    _keyStrUriSafe: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$",
    
    _getBaseValue: function (alphabet, character) {
        if (!LZString._baseReverseDic) {
            LZString._baseReverseDic = {};
        }
        if (!LZString._baseReverseDic[alphabet]) {
            LZString._baseReverseDic[alphabet] = {};
            for (var i = 0; i < alphabet.length; i++) {
                LZString._baseReverseDic[alphabet][alphabet[i]] = i;
            }
        }
        return LZString._baseReverseDic[alphabet][character];
    },

    compressToBase64: function (input) {
        if (input == null) return "";
        var output = LZString._compress(input, 6, function (a) {
            return LZString._keyStrBase64.charAt(a);
        });
        switch (output.length % 4) {
            default: 
            case 0: return output;
            case 1: return output + "===";
            case 2: return output + "==";
            case 3: return output + "=";
        }
    },

    decompressFromBase64: function (input) {
        if (input == null) return "";
        if (input === "") return null;
        return LZString._decompress(input.length, 32, function (index) {
            return LZString._getBaseValue(LZString._keyStrBase64, input.charAt(index));
        });
    },

    compressToUTF16: function (input) {
        if (input == null) return "";
        return LZString._compress(input, 15, function (a) {
            return String.fromCharCode(a + 32);
        }) + " ";
    },

    decompressFromUTF16: function (input) {
        if (input == null) return "";
        if (input === "") return null;
        return LZString._decompress(input.length, 16384, function (index) {
            return input.charCodeAt(index) - 32;
        });
    },

    compressToUint8Array: function (input) {
        var compressed = LZString.compress(input);
        var output = new Uint8Array(2 * compressed.length);
        for (var i = 0; i < compressed.length; i++) {
            var value = compressed.charCodeAt(i);
            output[2 * i] = value >>> 8;
            output[2 * i + 1] = value % 256;
        }
        return output;
    },

    decompressFromUint8Array: function (input) {
        if (input == null || input === undefined) return LZString.decompress(input);
        var charArray = new Array(input.length / 2);
        for (var i = 0; i < charArray.length; i++) {
            charArray[i] = 256 * input[2 * i] + input[2 * i + 1];
        }
        var result = "";
        charArray.forEach(function (charCode) {
            result += String.fromCharCode(charCode);
        });
        return LZString.decompress(result);
    },

    compressToEncodedURIComponent: function (input) {
        if (input == null) return "";
        return LZString._compress(input, 6, function (a) {
            return LZString._keyStrUriSafe.charAt(a);
        });
    },

    decompressFromEncodedURIComponent: function (input) {
        if (input == null) return "";
        if (input === "") return null;
        return LZString._decompress(input.length, 32, function (index) {
            return LZString._getBaseValue(LZString._keyStrUriSafe, input.charAt(index));
        });
    },

    compress: function (input) {
        return LZString._compress(input, 16, function (a) {
            return String.fromCharCode(a);
        });
    },

    _compress: function (uncompressed, bitsPerChar, getCharFromInt) {
        if (uncompressed == null) return "";
        
        var i, value, context_dictionary = {}, context_dictionaryToCreate = {},
            context_c = "", context_wc = "", context_w = "",
            context_enlargeIn = 2, context_dictSize = 3, context_numBits = 2,
            context_data_string = "", context_data_val = 0, context_data_position = 0,
            ii;

        for (ii = 0; ii < uncompressed.length; ii += 1) {
            context_c = uncompressed[ii];
            if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
                context_dictionary[context_c] = context_dictSize++;
                context_dictionaryToCreate[context_c] = true;
            }

            context_wc = context_w + context_c;
            if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
                context_w = context_wc;
            } else {
                if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
                    if (context_w.charCodeAt(0) < 256) {
                        for (i = 0; i < context_numBits; i++) {
                            context_data_val = (context_data_val << 1);
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data_string += getCharFromInt(context_data_val);
                                context_data_val = 0;
                            } else {
                                context_data_position++;
                            }
                        }
                        value = context_w.charCodeAt(0);
                        for (i = 0; i < 8; i++) {
                            context_data_val = (context_data_val << 1) | (value & 1);
                            if (context_data_position == bitsPerChar - 1) {
                                context_data_position = 0;
                                context_data_string += getCharFromInt(context_data_val);
                                context_data_val = 0;
                            } else {
                                context_data_position++;
                            }
                            value = value >> 1;
                        }
                    }
                }
                context_enlargeIn--;
                if (context_enlargeIn == 0) {
                    context_enlargeIn = Math.pow(2, context_numBits);
                    context_numBits++;
                }
                delete context_dictionaryToCreate[context_w];
            }
        }

        return context_data_string;
    },

    decompress: function (compressed) {
        if (compressed == null) return "";
        if (compressed === "") return null;
        return LZString._decompress(compressed.length, 32768, function (index) {
            return compressed.charCodeAt(index);
        });
    },

    _decompress: function (length, resetValue, getNextValue) {
        var dictionary = [], next, enlargeIn = 4, dictSize = 4, numBits = 3,
            entry = "", result = [], w, bits, resb, maxpower, power,
            c, data = { val: getNextValue(0), position: resetValue, index: 1 };

        for (i = 0; i < 3; i += 1) {
            dictionary[i] = i;
        }

        bits = 0;
        maxpower = Math.pow(2, 2);
        power = 1;
        while (power != maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position == 0) {
                data.position = resetValue;
                data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
        }

        next = bits;
        return result.join('');
    }
};


if (typeof module !== "undefined" && module != null) {
    module.exports = LZString;
}
