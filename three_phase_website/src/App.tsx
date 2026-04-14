import { useState, useEffect } from 'react'
import {importPublicKey, arrayBufferToBase64} from "../encryptionConverters.ts";

import './App.css'

function App() {
    const [key, setKey] = useState<CryptoKey>()
    const [page, setPage] = useState<string>("home")
    const [username, setUsername] = useState<string>("")
    const [password, setPassword] = useState<string>("")
    const [display, setDisplay] = useState<string>("")

    const [accounts, setAccounts] = useState<string>("")
    const [accoundID, setAccoundID] = useState<number>()
    const [type, setType] = useState<string>("")
    const [transaction, setTransaction] = useState<string>("")

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
        if (!key) {
            return;
        }
        const data = new TextEncoder().encode(dataToEncode)
        const encrypted = await window.crypto.subtle.encrypt(
            {name: 'RSA-OAEP'},
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
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    };


    async function login(username: string, password: string) {
        if (!username || !password) {
            setDisplay("Username and password are required");
            return;
        }
        setDisplay("Authenticating...");
        const encryptedUserName = await encrypt(username);
        const encryptedPassword = await encrypt(password);
        console.log("USER", encryptedUserName);
        console.log("PASS", encryptedPassword);
        if (!encryptedUserName || !encryptedPassword) {
            setDisplay("Encryption not ready — try again");
            return;
        }
        fetch(`${serverLocation}/accounts?u=${base64ToUrlSafe(encryptedUserName)}&p=${base64ToUrlSafe(encryptedPassword)}`)
            .then(res => {
                if (!res.ok) {
                    console.error(res, res.status, res.json().then(message => {
                        return message
                    }));
                    setDisplay("Invalid username or password");
                } else {
                    res.json().then(data => {
                        setAccounts(data.success ?? []);
                        setDisplay("");
                        setPage("dashboard");
                    });
                }
            });
    }


    async function signup(username: string, password: string) {
        if (!username || !password) {
            setDisplay("Username and password are required");
            return;
        }
        setDisplay("Creating account...");
        const encryptedUserName = await encrypt(username);
        const encryptedPassword = await encrypt(password);
        console.log("USER", encryptedUserName);
        console.log("PASS", encryptedPassword);
        if (!encryptedUserName || !encryptedPassword) {
            setDisplay("Encryption not ready — try again");
            return;
        }
        fetch(`${serverLocation}/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({encryptedUserName, encryptedPassword}),
        }).then(res => {
            if (!res.ok) {
                console.error(res, res.status, res.json().then(message => {
                    return message
                }));
                setDisplay("Failed to create account");
            } else {
                setDisplay("Successfully created account");
                login(username, password);
            }
        });
    }

    async function fetchAccounts() {
        const encryptedUserName = await encrypt(username);
        const encryptedPassword = await encrypt(password);
        if (!encryptedUserName || !encryptedPassword) return;
        fetch(`${serverLocation}/accounts?u=${base64ToUrlSafe(encryptedUserName)}&p=${base64ToUrlSafe(encryptedPassword)}`)
            .then(res => {
                if (!res.ok) {
                    console.error(res, res.status, res.json().then(message => {
                        return message
                    }));
                } else {
                    res.json().then(data => setAccounts(data.success ?? []));
                }
            });
    }

    async function fetchTransactions(accountID: number) {
        setAccoundID(accountID);
        setTransaction([]);
        const encryptedUserName = await encrypt(username);
        const encryptedPassword = await encrypt(password);
        if (!encryptedUserName || !encryptedPassword) return;
        fetch(`${serverLocation}/transactions?u=${base64ToUrlSafe(encryptedUserName)}&p=${base64ToUrlSafe(encryptedPassword)}&accountID=${accountID}`)
            .then(res => {
                if (!res.ok) {
                    console.error(res, res.status, res.json().then(message => {
                        return message
                    }));
                } else {
                    res.json().then(data => setTransaction(data.success ?? []));
                }
            });
    }

    async function createBankAccount(username: string, password: string) {
        setDisplay("Creating account...");
        const encryptedUserName = await encrypt(username);
        const encryptedPassword = await encrypt(password);
        if (!encryptedUserName || !encryptedPassword) {
            setDisplay("Encryption not ready");
            return;
        }
        fetch(`${serverLocation}/account`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({encryptedUserName, encryptedPassword, accountType: type}),
        }).then(res => {
            if (!res.ok) {
                console.error(res, res.status, res.json().then(message => {
                    return message
                }));
                setDisplay("Failed to create account");
            } else {
                setDisplay("Account created");
                fetchAccounts();
            }
        });
    }

    async function doDeposit(username: string, password: string) {
        if (!accoundID || !amount) {
            setDisplay("Select an account and enter an amount");
            return;
        }
        setDisplay("Processing deposit...");
        const encryptedUserName = await encrypt(username);
        const encryptedPassword = await encrypt(password);
        if (!encryptedUserName || !encryptedPassword) {
            setDisplay("Encryption not ready");
            return;
        }
        fetch(`${serverLocation}/deposit`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({encryptedUserName, encryptedPassword, accountID: accoundID, amount}),
        }).then(res => {
            if (!res.ok) {
                console.error(res, res.status, res.json().then(message => {
                    return message
                }));
                setDisplay("Deposit failed");
            } else {
                setDisplay("Deposit successful");
                fetchAccounts();
                fetchTransactions(accoundID);
            }
        });
    }

    async function doWithdraw() {
        if (!accoundID || !amount) {
            setDisplay("Select an account and enter an amount");
            return;
        }
        setDisplay("Processing withdrawal...");
        const encryptedUserName = await encrypt(username);
        const encryptedPassword = await encrypt(password);
        if (!encryptedUserName || !encryptedPassword) {
            setDisplay("Encryption not ready");
            return;
        }
        fetch(`${serverLocation}/withdraw`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({encryptedUserName, encryptedPassword, accountID: accoundID, amount}),
        }).then(res => {
            if (!res.ok) {
                console.error(res, res.status, res.json().then(message => {
                    return message
                }));
                setDisplay("Withdrawal failed");
            } else {
                setDisplay("Withdrawal successful");
                fetchAccounts();
                fetchTransactions(accoundID);
            }
        });
    }

    async function doTransfer(username: string, password: string) {
        if (!fromAcc || !toAcc || !amount) {
            setDisplay("Fill in all transfer fields");
            return;
        }
        setDisplay("Processing transfer...");
        const encryptedUserName = await encrypt(username);
        const encryptedPassword = await encrypt(password);
        if (!encryptedUserName || !encryptedPassword) {
            setDisplay("Encryption not ready");
            return;
        }
        fetch(`${serverLocation}/transfer`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                encryptedUserName,
                encryptedPassword,
                fromAccountID: fromAcc,
                toAccountID: toAcc,
                amount
            }),
        }).then(res => {
            if (!res.ok) {
                console.error(res, res.status, res.json().then(message => {
                    return message
                }));
                setDisplay("Transfer failed");
            } else {
                setDisplay("Transfer successful");
                fetchAccounts();
            }
        });
    }

    const isError = display.toLowerCase().includes("fail") ||
        display.toLowerCase().includes("invalid") ||
        display.toLowerCase().includes("denied") ||
        display.toLowerCase().includes("error") ||
        display.toLowerCase().includes("incorrect") ||
        display.toLowerCase().includes("insufficient");

    const msgClass = `display-msg${isError ? ' display-msg' : ''}`;

    if (page === "home") {
        return (
            <>
                <div id="welcome">Welcome to Allen's Bank</div>
                <div id="username"><input placeholder="Username" value={username}
                                          onChange={e => setUsername(e.target.value)}></input></div>
                <div id="password"><input type="password" placeholder="Password" value={password}
                                          onChange={e => setPassword(e.target.value)}></input></div>

                <div id="buttons">
                    <button onClick={login}>Login</button>
                    <button onClick={signup}>Create</button>
                </div>
            </>
        )
    }
}

export default App
