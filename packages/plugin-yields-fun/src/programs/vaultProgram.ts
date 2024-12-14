import {
    Account,
    Pubkey,
    Result,
    Signer,
    SystemAccount,
    TokenAccount,
    TokenProgram,
    u64,
    u8,
} from "@solanaturbine/poseidon";

// Define the vault state account structure
interface VaultState extends Account {
    owner: Pubkey;
    totalShares: u64;
    totalAssets: u64;
    performanceFee: u8;
    managementFee: u8;
    lastHarvestTime: u64;
    stateBump: u8;
    authBump: u8;
    vaultBump: u8;
}

// Define the user position account structure
interface UserPosition extends Account {
    owner: Pubkey;
    shares: u64;
    depositedAmount: u64;
    lastDepositTime: u64;
}

export default class VaultProgram {
    static PROGRAM_ID = new Pubkey("11111111111111111111111111111111"); // Replace with actual program ID

    initialize(
        owner: Signer,
        state: VaultState,
        auth: SystemAccount,
        vault: TokenAccount,
        tokenMint: Pubkey,
        performanceFee: u8,
        managementFee: u8
    ): Result {
        // Derive PDAs
        auth.derive(["auth", state.key]);
        state.derive(["state", owner.key]).init(owner);
        vault.derive(["vault", auth.key]);

        // Initialize state
        state.owner = owner.key;
        state.totalShares = 0;
        state.totalAssets = 0;
        state.performanceFee = performanceFee;
        state.managementFee = managementFee;
        state.lastHarvestTime = 0;
        state.stateBump = state.getBump();
        state.authBump = auth.getBump();
        state.vaultBump = vault.getBump();

        // Initialize token account
        TokenProgram.initializeAccount({
            account: vault,
            mint: tokenMint,
            owner: auth.key,
        });
    }

    deposit(
        user: Signer,
        state: VaultState,
        auth: SystemAccount,
        vault: TokenAccount,
        userToken: TokenAccount,
        userPosition: UserPosition,
        amount: u64
    ): Result {
        // Verify PDAs
        state.deriveWithBump(["state", state.owner], state.stateBump);
        auth.deriveWithBump(["auth", state.key], state.authBump);
        vault.deriveWithBump(["vault", auth.key], state.vaultBump);

        // Calculate shares
        const shares = this.calculateShares(
            amount,
            state.totalAssets,
            state.totalShares
        );

        // Transfer tokens to vault
        TokenProgram.transfer({
            from: userToken,
            to: vault,
            authority: user,
            amount,
        });

        // Update state
        state.totalShares += shares;
        state.totalAssets += amount;

        // Update user position
        userPosition.owner = user.key;
        userPosition.shares += shares;
        userPosition.depositedAmount += amount;
        userPosition.lastDepositTime = Date.now();
    }

    withdraw(
        user: Signer,
        state: VaultState,
        auth: SystemAccount,
        vault: TokenAccount,
        userToken: TokenAccount,
        userPosition: UserPosition,
        shares: u64
    ): Result {
        // Verify PDAs
        state.deriveWithBump(["state", state.owner], state.stateBump);
        auth.deriveWithBump(["auth", state.key], state.authBump);
        vault.deriveWithBump(["vault", auth.key], state.vaultBump);

        // Calculate amount
        const amount = this.calculateAmount(
            shares,
            state.totalAssets,
            state.totalShares
        );

        // Transfer tokens to user
        TokenProgram.transfer({
            from: vault,
            to: userToken,
            authority: auth,
            amount,
            seeds: ["vault", state.key, state.authBump],
        });

        // Update state
        state.totalShares -= shares;
        state.totalAssets -= amount;

        // Update user position
        userPosition.shares -= shares;
        userPosition.depositedAmount -= amount;
    }

    harvest(
        owner: Signer,
        state: VaultState,
        auth: SystemAccount,
        vault: TokenAccount,
        feeAccount: TokenAccount
    ): Result {
        // Verify owner
        if (!owner.key.equals(state.owner)) {
            throw new Error("Unauthorized");
        }

        // Verify PDAs
        state.deriveWithBump(["state", state.owner], state.stateBump);
        auth.deriveWithBump(["auth", state.key], state.authBump);
        vault.deriveWithBump(["vault", auth.key], state.vaultBump);

        // Calculate fees
        const currentTime = Date.now();
        const timeDelta = currentTime - state.lastHarvestTime;

        const managementFeeAmount = this.calculateManagementFee(
            state.totalAssets,
            state.managementFee,
            timeDelta
        );

        const performanceFeeAmount = this.calculatePerformanceFee(
            state.totalAssets,
            vault.amount,
            state.performanceFee
        );

        const totalFees = managementFeeAmount + performanceFeeAmount;

        // Transfer fees
        if (totalFees > 0) {
            TokenProgram.transfer({
                from: vault,
                to: feeAccount,
                authority: auth,
                amount: totalFees,
                seeds: ["vault", state.key, state.authBump],
            });
        }

        // Update state
        state.lastHarvestTime = currentTime;
        state.totalAssets = vault.amount - totalFees;
    }

    private calculateShares(
        amount: u64,
        totalAssets: u64,
        totalShares: u64
    ): u64 {
        if (totalAssets === 0 || totalShares === 0) {
            return amount;
        }
        return (amount * totalShares) / totalAssets;
    }

    private calculateAmount(
        shares: u64,
        totalAssets: u64,
        totalShares: u64
    ): u64 {
        return (shares * totalAssets) / totalShares;
    }

    private calculateManagementFee(
        totalAssets: u64,
        feeRate: u8,
        timeDelta: number
    ): u64 {
        // Annual fee rate to per-second rate
        const secondRate = feeRate / 100 / (365 * 24 * 60 * 60);
        return totalAssets * secondRate * timeDelta;
    }

    private calculatePerformanceFee(
        oldTotal: u64,
        newTotal: u64,
        feeRate: u8
    ): u64 {
        if (newTotal <= oldTotal) return 0;
        const profit = newTotal - oldTotal;
        return (profit * feeRate) / 100;
    }
}
