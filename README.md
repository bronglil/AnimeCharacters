# anime-ascii

Convert images to ASCII art (Node.js).

```bash
cd js
npm install
npx anime-ascii photo.png -w 48 --style relief -r classic
```

```js
import { convertPath } from "anime-ascii";

const art = await convertPath("photo.png", {
  columns: 48,
  style: "relief",
  ramp: "classic",
});
console.log(art);
```

## Sample

```
                    #####%###
                  #%#.......##
                 ##..........##
                 =............=
                 =............=
                 ==..........==
                  ===.......==
                    ===..====
                      ====
                       ==
                       ==
                    ---====-
                  ===:..:::=--
                 %@@@@%%%@@@@@@
                @@%@@@@%%%@@@@@@@
              @@@@@%@@@@%%%@@@@@@@
             @@@@@@%%@@@%%%%@@@@@@@
           @@@@@@@@@%%@@@@%%%@@@@@@@@
          @@@@@@@@@@@%%@@@@@%%@@@@@@@@
        @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
       @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
     @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
    @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
```

Hollow face (`.`), outline (`#%=`), dense shoulders (`@`).

## License

MIT
