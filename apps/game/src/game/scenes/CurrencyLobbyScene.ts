import { loadPersistentWallet } from "../settlement/persistent-wallet";
import { LobbyScene } from "./CoreFlowScenes";

export class CurrencyLobbyScene extends LobbyScene {
  create(): void {
    super.create();
    const storage = typeof localStorage === "undefined" ? undefined : localStorage;
    const wallet = loadPersistentWallet(storage);
    this.add
      .text(this.scale.gameSize.width - 28, 26, `총 골드  ${wallet.totalCurrency}`, {
        fontFamily: 'Galmuri9, "Apple SD Gothic Neo", monospace',
        fontSize: "20px",
        color: "#f5cf72",
      })
      .setOrigin(1, 0)
      .setDepth(20);
  }
}
