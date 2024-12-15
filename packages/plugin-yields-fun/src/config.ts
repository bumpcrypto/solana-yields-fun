import { Raydium, TxVersion } from "@raydium-io/raydium-sdk-v2";
import { Connection, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

// We'll get these from environment variables or runtime settings
let raydium: Raydium | undefined;
export const txVersion = TxVersion.V0; // or TxVersion.LEGACY

export const initSdk = async (params: {
    owner: Keypair;
    connection: Connection;
    cluster?: "mainnet" | "devnet";
    loadToken?: boolean;
}) => {
    if (raydium) return raydium;

    const {
        owner,
        connection,
        cluster = "mainnet",
        loadToken = false,
    } = params;

    raydium = await Raydium.load({
        owner,
        connection,
        cluster,
        disableFeatureCheck: true,
    });

    // Optional: Set up token account handling
    /*
  raydium.account.updateTokenAccount(await fetchTokenAccountData())
  connection.onAccountChange(owner.publicKey, async () => {
    raydium!.account.updateTokenAccount(await fetchTokenAccountData())
  })
  */

    return raydium;
};

export const fetchTokenAccountData = async (
    owner: Keypair,
    connection: Connection
) => {
    const solAccountResp = await connection.getAccountInfo(owner.publicKey);
    const tokenAccountResp = await connection.getTokenAccountsByOwner(
        owner.publicKey,
        { programId: TOKEN_PROGRAM_ID }
    );
    const token2022Req = await connection.getTokenAccountsByOwner(
        owner.publicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
    );

    return {
        owner: owner.publicKey,
        solAccountResp,
        tokenAccountResp: {
            context: tokenAccountResp.context,
            value: [...tokenAccountResp.value, ...token2022Req.value],
        },
    };
};
