import { useState, useEffect } from 'react'
import {importPublicKey, arrayBufferToBase64} from "../encryptionConverters.ts";

import './App.css'

function App() {
    const [key, setKey] = useState<CryptoKey>()
    const [page, setPage] = useState<string>()
    const [username, setUsername] = useState<string>()
    const [password, setPassword] = useState<string>()
    const [display, setDisplay] = useState<string>()

    const [accounts, setAccounts] = useState<string>()
    const [accoundID, setAccoundID] = useState<number>()
    const [type, setType] = useState<string>()
    const [transaction, setTransaction] = useState<string>()

    const [toAcc, setToAcc] = useState<number>()
    const [fromAcc, setFromAcc] = useState<number>()
    const [amount, setAmount] = useState<number>()

    const serverLocation = "http://localhost:3000";

    const refreshKey = () => {
        fetch(`${serverLocation}/public_key`)
            .then(res => res.json())
            .then(public_key => {
                importPublicKey(public_key).then(cryptKey => setKey(cryptKey));
            });
    }
    useEffect(() => {
        refreshKey();
    }, []);


    async function encrypt(dataToEncode: string) {
        if(!key){
            return;
        }

        const data = new TextEncoder().encode(dataToEncode)

        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: 'RSA-OAEP',
            },
            key,
            data
        );
        console.log("BUFFER", encrypted);

        const stringed = arrayBufferToBase64(encrypted);
        console.log("STRING", stringed);
        return stringed;

    }

    async function login(username: string, password: string) {
        const encryptedUsername = base64ToUrlSafe(username);
        const encryptedPassword = base64ToUrlSafe(password);
        fetch(`${serverLocation}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                encryptedUsername,
                encryptedPassword
            }),
        }).then(res => {
            if (!res.ok) {
                console.log(res, res.status, res.json().then(message => {
                    return message
                }))
                setDisplay("Failed to login");
            }
            else {
                res.json().then((data) => {
                    setAccounts(data)
                })
            }
        })
        setPage("Dashboard");
    }

    async function createAccount(username: string, password: string) {
        setDisplay("Creating account...")
        const encryptedUsername = encrypt(username);
        const encryptedPassword = encrypt(password);
        console.log("USER", encryptedUsername);
        console.log("PASS", encryptedPassword);
        fetch(`${serverLocation}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                encryptedUsername,
                encryptedPassword
            }),
        }).then(res => {
            if (!res.ok) {
                console.log(res, res.status, res.json().then(message => {
                    return message
                }))
                setDisplay("Failed to create account");
            }
            else {
                login(username, password);
                setDisplay("Successfully created account");
            }
        })
    }

    const base64ToUrlSafe = (base64Str: string): string => {
        return base64Str
            .replace(/\+/g, '-') // Replace + with -
            .replace(/\//g, '_') // Replace / with _
            .replace(/=+$/, ''); // Remove trailing = padding
    };


  return (
      <>
          <div id="welcome">Welcome to Allen's Bank</div>
          <div id="username"><input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)}></input></div>
          <div id="password"><input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}></input></div>

          <div id="buttons">
              <button>Login</button>
              <button>Create</button>
          </div>
      </>
  )
}

export default App
