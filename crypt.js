// https://github.com/noahcoolboy/funcaptcha/blob/master/lib/crypt.js#L33

const { createHash, createDecipheriv } = require('crypto');

/**
 * @param {string} rawData 
 * @param {string} key 
 * @returns 
 */
function decrypt(rawData, key) {
    let data = JSON.parse(rawData);

    let dk = Buffer.concat([Buffer.from(key), Buffer.from(data.s, "hex")]);
    let arr = [Buffer.from(createHash("md5").update(dk).digest()).toString("hex")];
    let result = arr[0];

    for (let x = 1; x < 3; x++) {
        arr.push(
            Buffer.from(
                createHash("md5")
                    .update(Buffer.concat([Buffer.from(arr[x - 1], "hex"), dk]))
                    .digest()
            ).toString("hex")
        );
        result += arr[x];
    }

    let aes = createDecipheriv(
        "aes-256-cbc",
        Buffer.from(result.substring(0, 64), "hex"),
        Buffer.from(data.iv, "hex")
    );
    
    return aes.update(data.ct, "base64", "utf8") + aes.final("utf8");
}

module.exports = {
    decrypt
}
