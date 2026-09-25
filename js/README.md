# anime-ascii

Convert images to ASCII art (Node.js).

```bash
npm install
npx anime-ascii photo.png -w 64 --style relief -r classic
```

```js
import { convertPath } from "anime-ascii";

const art = await convertPath("photo.png", {
  columns: 64,
  style: "relief",
  ramp: "classic",
});
console.log(art);
```

## Sample

```
                         ******
                      *********#**
                    *****++==++*****
                   **+=--::::::--=+*#
                   #*+=--::..::--=+*#
                        ##*++*##
                 #########*++*##########
              ###*******++++++++*******###
           #%###****+++++++++++++++++***###%#
         #%%%###############################%%%
       %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
```

## License

MIT
