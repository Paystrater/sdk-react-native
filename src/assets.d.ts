// Metro and Expo turn an imported image into an asset reference for <Image source>
declare module "*.png" {
  const asset: number
  export default asset
}
