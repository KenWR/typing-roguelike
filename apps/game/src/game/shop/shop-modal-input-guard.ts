export type ShopModalInputGuardLayout = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export const createShopModalInputGuardLayout = (
  width: number,
  height: number,
): ShopModalInputGuardLayout => ({
  x: width / 2,
  y: height / 2,
  width,
  height,
});

export const stopShopModalPointerPropagation = (
  stopPropagation: () => void,
): void => {
  stopPropagation();
};
