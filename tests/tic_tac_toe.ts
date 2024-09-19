import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorError } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { TicTacToe } from "../target/types/tic_tac_toe";

async function play(
  program: Program<TicTacToe>,
  game,
  player,
  tile,
  expectedTurn,
  expectedGameState,
  expectedBoard
) {
  await program.methods
    .play(tile)
    .accounts({
      player: player.publicKey,
      game,
    })
    .signers(player instanceof (anchor.Wallet as any) ? [] : [player])
    .rpc();

  const gameState = await program.account.game.fetch(game);
  expect(gameState.turn).to.equal(expectedTurn);
  expect(gameState.state).to.eql(expectedGameState);
  expect(gameState.board).to.eql(expectedBoard);
}

describe("tic_tac_toe", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TicTacToe as Program<TicTacToe>;
  const playerOne = (program.provider as anchor.AnchorProvider).wallet;
  const gameKeyPair = Keypair.generate();
  const playerTwoKeyPair = Keypair.generate();

  it("Game Setup!", async () => {
    let tx_1 = await program.methods
      .setupGame(playerTwoKeyPair.publicKey)
      .accounts({
        game: gameKeyPair.publicKey,
        playerOne: playerOne.publicKey,
      })
      .signers([gameKeyPair])
      .rpc();

    let gameState = await program.account.game.fetch(gameKeyPair.publicKey);

    expect(gameState.turn).to.equal(1);
    expect(gameState.players).to.eql([
      playerOne.publicKey,
      playerTwoKeyPair.publicKey,
    ]);
    expect(gameState.state).to.eql({ active: {} });
    expect(gameState.board).to.eql([
      [null, null, null],
      [null, null, null],
      [null, null, null],
    ]);
  });

  it("player one wins", async () => {
    const gameKeypair = Keypair.generate();
    const playerOne = (program.provider as anchor.AnchorProvider).wallet;
    const playerTwo = Keypair.generate();

    await program.methods
      .setupGame(playerTwo.publicKey)
      .accounts({
        game: gameKeypair.publicKey,
        playerOne: playerOne.publicKey,
      })
      .signers([gameKeypair])
      .rpc();

    await play(
      program,
      gameKeypair.publicKey,
      playerOne,
      { row: 0, column: 0 },
      2,
      { active: {} },
      [
        [{ x: {} }, null, null],
        [null, null, null],
        [null, null, null],
      ]
    );

    await play(
      program,
      gameKeypair.publicKey,
      playerTwo,
      { row: 0, column: 1 },
      3,
      { active: {} },
      [
        [{ x: {} }, { o: {} }, null],
        [null, null, null],
        [null, null, null],
      ]
    );
    await play(
      program,
      gameKeypair.publicKey,
      playerOne,
      { row: 1, column: 1 },
      4,
      { active: {} },
      [
        [{ x: {} }, { o: {} }, null],
        [null, { x: {} }, null],
        [null, null, null],
      ]
    );
    await play(
      program,
      gameKeypair.publicKey,
      playerTwo,
      { row: 2, column: 1 },
      4,
      { active: {} },
      [
        [{ x: {} }, { o: {} }, null],
        [null, { x: {} }, null],
        [null, { o: {} }, null],
      ]
    );

    await play(
      program,
      gameKeypair.publicKey,
      playerOne,
      { row: 2, column: 2 },
      4,
      { active: { winner: playerOne.publicKey } },
      [
        [{ x: {} }, { o: {} }, { x: {} }],
        [null, { x: {} }, null],
        [null, null, { x: {} }],
      ]
    );
  });
  it("out of bounds move", async () => {
    const gameKeypair = Keypair.generate();
    const playerOne = (program.provider as anchor.AnchorProvider).wallet;
    const playerTwo = Keypair.generate();

    await program.methods
      .setupGame(playerTwo.publicKey)
      .accounts({
        game: gameKeypair.publicKey,
        playerOne: playerOne.publicKey,
      })
      .signers([gameKeypair])
      .rpc();

    try {
      await play(
        program,
        gameKeypair.publicKey,
        playerTwo,
        { row: 5, column: 1 }, // ERROR: out of bounds row
        4,
        { active: {} },
        [
          [null, null, null],
          [null, null, null],
          [null, null, null],
        ]
      );
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.number).to.equal(6000);
    }
  });

  it("same player turn", async () => {
    const gameKeypair = anchor.web3.Keypair.generate();
    const playerOne = (program.provider as anchor.AnchorProvider).wallet;
    const playerTwo = anchor.web3.Keypair.generate();

    await program.methods
      .setupGame(playerTwo.publicKey)
      .accounts({
        game: gameKeypair.publicKey,
        playerOne: playerOne.publicKey,
      })
      .signers([gameKeypair])
      .rpc();

    await play(
      program,
      gameKeypair.publicKey,
      playerOne,
      { row: 0, column: 0 },
      2,
      { active: {} },
      [
        [{ x: {} }, null, null],
        [null, null, null],
        [null, null, null],
      ]
    );

    try {
      await play(
        program,
        gameKeypair.publicKey,
        playerOne,
        { row: 1, column: 0 },
        3,
        { active: {} },
        [
          [{ x: {} }, null, null],
          [null, null, null],
          [null, null, null],
        ]
      );
      chai.assert(false, "should've failed but didn't");
    } catch (_err) {
      expect(_err).to.be.instanceOf(AnchorError);
      const err: AnchorError = _err;
      expect(err.error.errorCode.code).to.equal("NotPlayersTurn");
      expect(err.error.errorCode.number).to.equal(6003);
    }
  });
});
