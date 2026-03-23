import mysql from "mysql2/promise";
import config from "./config.js"
import express from "express"
import cors from "cors"
import bodyParser from "body-parser"
import crypto from "node:crypto"

const app = express();

const connection = await mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.pass,
    port: config.db.port,
    database: config.db.db

})
app.use(cors({
    methods: ['GET', 'POST'] // Specify allowed methods
}));

app.use(bodyParser.json());
const port = 3000;


const generateKeys = () => {
    const keys = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048, // Recommended key size for security
        publicKeyEncoding: {
            type: 'spki', // Recommended for public keys
            format: 'pem',
        },
        privateKeyEncoding: {
            type: 'pkcs8', // Recommended for private keys
            format: 'pem',
        },
    });
    console.log('Private Key:', keys.privateKey);
    console.log('Public Key:', keys.publicKey);
    return keys;
}
const decryptData = (user) => {
    // 1. Convert from encoded string to a buffer
    const buffer = Buffer.from(user, 'base64');

    // 2. Explicitly define padding and hash to match the Web Crypto API
    return crypto.privateDecrypt(
        {
            key: privateKey, // Your 2048-bit key from generateKeys()
            oaepHash: "sha256", // MUST BE THIS to match client's "SHA-256"
        },
        buffer
    ).toString("utf8");
};
function verifyPassword(inputPassword, storedSalt, storedHash, actionOnSuccess, actionOnFail) {
    crypto.scrypt(inputPassword, storedSalt, 64, (err, derivedKey) => {
        if (err) throw err;

        const inputHash = derivedKey.toString('hex');

        // Compare the newly generated hash with the one stored in the database
        if(storedHash === inputHash) {
            actionOnSuccess();
        } else
            actionOnFail();
    });
}
const urlSafeToBase64 = (urlSafeStr) => {
    // Add padding back for standard Base64 if needed
    let standardB64 = urlSafeStr.replace(/-/g, '+').replace(/_/g, '/');
    while (standardB64.length % 4) {
        standardB64 += '=';
    }
    return standardB64;
};
let {publicKey, privateKey} = generateKeys();


async function getUser(username)
{
    const [results, fields] = await connection.query(`SELECT * FROM logins WHERE username = "${username}"`);
    if (results.length === 1) {
        return results[0];
    }
    return false;
}

async function getAccount(user)
{
    if (user.access === 1) {
        const [results, fields] = await connection.query(`SELECT DISTINCT accounts.accountID, accounts.balance, accounts.accountType, accounts.ownerID FROM accounts`);
        return results;
    }
    const [results, fields] = await connection.query(`SELECT DISTINCT accounts.accountID, accounts.balance, accounts.accountType, accounts.ownerID FROM accounts WHERE accounts.ownerID = "${user.id}"`)
    return results;
}

async function getTransactions(accountID)
{
    const [results, fields] = await connection.query(`SELECT DISTINCT transactions.transactionID, transactions.amount, transactions.fromAcc, transactions.toAcc FROM transactions WHERE transactions.toAcc = "${accountID}" OR transaction.fromAcc = "${accountID}"`);
    return results;
}

async function maxID()
{
    const [results, fields] = await connection.query(`SELECT max(id) FROM logins`);
    return results[0]["max(id)"];
}

async function maxAccountID()
{
    const [results, fields] = await connection.query(`SELECT max(accountID) FROM accounts`);
    return results[0]["max(accountID)"];
}

async function maxTransactions()
{
    const [results, fields] = await connection.query(`SELECT max(amount) FROM transactions`);
    return results[0]["max(amount)"];
}

async function createUser(user, password)
{
    const salt = crypto.randomBytes(16).toString('hex');
    let id = await maxID() + 1;

    crypto.scrypt(password, salt, 64, async (err, derivedKey) => {
        if (err) throw err;
        const hash = derivedKey.toString('hex');

        await connection.query(`INSERT into logins values("${user}", ${id},"${hash}", "${salt}", 0)`)
    })
}

createUser("bigp", "patel").then(r => {

})

createAccount("Checking", 2).then(r =>{

})

async function createAccount(type, ownerID)
{
    let id = await maxAccountID() + 1;
    await connection.query(`INSERT into accounts(accountID, accountType, ownerID) values (${id}, "${type}", ${ownerID})`);
}

async function verifyAccess(user, accountID)
{
    const [results, fields] = await connection.query(`SELECT DISTINCT ownerID FROM accounts WHERE ownerID = "${accountID}"`);
    if(user.access === 1) {
        return true;
    }
    if (results.length > 1 && user.id === results[0].ownerID) {
        return true;
    }
    return false;
}

async function verifyBalance(accountID, amount)
{
    const [results, fields] = await connection.query(`SELECT DISTINCT * FROM accounts WHERE accountID = "${accountID}"`);
    if (results[0].balance >= amount) {
        return true;
    }
    return false;
}

async function transfer(user, accountID1, accountID2, amount)
{
    if (await verifyAccess(user, accountID1) && await verifyAccess(user, accountID2)) {
        if(await verifyBalance(accountID1, amount)) {
            const[results1, fields1] = await connection.query(`UPDATE accounts SET balance = accounts.balance + ${amount} WHERE accountID = ${accountID1}`);
            let newBalAcc1 = results1[0].balance + amount;

            const[results2, fields2] = await connection.query(`UPDATE accounts SET balance = accounts.balance + ${amount} WHERE accountID = ${accountID2}`);
            let newBalAcc2 = results2[0].balance + amount;

            await connection.query(`UPDATE accounts SET balance = accounts.balance + ${amount} WHERE accountID = ${accountID1}`);
            await connection.query(`UPDATE accounts SET balance = accounts.balance + ${amount} WHERE accountID = ${accountID2}`);

            let id = await maxTransactions() + 1;
            await connection.query(`INSERT into transactions.values(${id}, ${amount}, ${accountID1}, ${accountID2})`)
            return 200;
        }
        else
        {
            return 400;
        }
    }
    else
    {
        return 400;
    }
}

async function deposit(user, accountID, amount)
{
    if (await verifyAccess(user, accountID))
    {
        const[results, fields] = await connection.query(`UPDATE accounts SET balance accounts.balance + ${amount} WHERE accountID = ${accountID}`);
        let newBal = results[0].balance + amount;

        await connection.query(`UPDATE accounts SET balance accounts.balance + ${amount} WHERE accountID = ${accountID}`);
        let id = await maxTransactions() + 1;
        await connection.query(`INSERT into transactions.values(${id}, ${amount})`)
    }
}
app.put("/data", (req, res) => {
    const {encryptedUserName, encryptedPassword, encryptedData} = req.body;
    const user = req.query.user;

    if (!encryptedUserName || !encryptedPassword || !encryptedData || !user) {
        return res.status(400).json({error: "Invalid encrypted data provided"});
    }
    let decryptedUser = decryptData(encryptedUserName);
    let decryptedPassword = decryptData(encryptedPassword);
    let decryptedData = decryptData(encryptedData);
    let userFound = false;
    let isAdmin = false;

    for (let i = 0; i < admin.length; i++) {
        if (admin[i].username === decryptedUser)
        {
            isAdmin = true;
            for (let j = 0; j < users.length; j++) {
                if (user === users[j].username)
                {
                    userFound = true;
                    verifyPassword(decryptedPassword, admin[i].salt, admin[i].hash, () => {
                        users[j].data = decryptedData;
                        return res.status(200).json({success: 'Successfully verified'});
                    }, () => {
                        return res.status(400).json({error: 'Unauthorized access'});
                    });
                }
            }
        }
    }
    if (!isAdmin)
    {
        for (let i = 0; i < users.length; i++)
        {
            if (user === users[i].username && user === decryptedUser)
            {
                userFound = true;
                verifyPassword(decryptedPassword, users[i].salt, users[i].hash, () => {
                    users[i].data = decryptedData;
                    return res.status(200).json({success: 'Successfully verified'});
                }, () => {
                    return res.status(400).json({error: 'Unauthorized access'});
                });
            }
        }
    }

    if (!userFound)
    {
        return res.status(400).json({error: "User not found"});
    }
});


app.get("/data", (req, res) => {
    const {u, p} = req.query;
    const user = req.query.user;

    if (!u || !p || !user) {
        return res.status(400).json({error: "Invalid query parameters"})
    }
    let encryptedUserName = urlSafeToBase64(u);
    let encryptedPassword = urlSafeToBase64(p);
    let decryptedUser = decryptData(encryptedUserName);
    let decryptedPassword = decryptData(encryptedPassword);

    let userFound = false;
    let isAdmin = false;


    for (let i = 0; i < admin.length; i++) {
        if (admin[i].username === decryptedUser)
        {
            isAdmin = true;
            for (let j = 0; j < users.length; j++) {
                if (user === users[j].username)
                {
                    userFound = true;
                    verifyPassword(decryptedPassword, admin[i].salt, admin[i].hash, () => {
                        return res.status(200).json(users[j].data);
                    }, () => {
                        return res.status(400).json({error: 'Unauthorized access'});
                    });
                }
            }
        }
    }
    if (!isAdmin)
    {
        for (let i = 0; i < users.length; i++)
        {
            if (user === users[i].username && user === decryptedUser)
            {
                userFound = true;
                verifyPassword(decryptedPassword, users[i].salt, users[i].hash, () => {
                    return res.status(200).json(users[i].data);
                }, () => {
                    return res.status(400).json({error: 'Unauthorized access'});
                });
            }
        }
    }

    if (!userFound)
    {
        return res.status(400).json({error: "User not found"});
    }
});


app.get("/accounts", (req, res) => {

})

app.get("/transactions", (req, res) => {

})

app.post("/login", (req, res) => {})

app.post("/account", (req, res) => {})

app.post("/deposit", (req, res) => {})

app.post("/withdraw", (req, res) => {})

app.post("/transfer", (req, res) => {})



app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})

getUser("JP").then((user) => {
    getAccount(user).then((account) => {
        console.log(account);
    })
})