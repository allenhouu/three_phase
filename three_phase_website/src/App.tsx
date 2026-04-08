import { useState, useEffect } from 'react'
import {importPublicKey, arrayBufferToBase64} from "../encryptionConverters.ts";

import './App.css'

function App() {
    const [username, setUsername] = useState<CryptoKey>()
    const [password, setPassword] = useState<CryptoKey>()
    const [key, setKey] = useState<CryptoKey>()
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

    const base64ToUrlSafe = (base64Str: string): string => {
        return base64Str
            .replace(/\+/g, '-') // Replace + with -
            .replace(/\//g, '_') // Replace / with _
            .replace(/=+$/, ''); // Remove trailing = padding
    };


  return (
      <>
          <div id="welcome">Welcome to Allen Bank</div>
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
