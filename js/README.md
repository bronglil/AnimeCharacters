# anime-ascii

Convert images to ASCII art (Node.js).

```bash
npm install
npx anime-ascii photo.png -w 58 --style portrait -r classic
npx anime-ascii photo.png -w 64 --quality high --color
```

```js
import { convertPath, convertPathColored } from "anime-ascii";

console.log(
  await convertPath("photo.png", { columns: 58, style: "portrait", ramp: "classic" }),
);

const colored = await convertPathColored("sprite.png", { columns: 64, quality: "high" });
// colored.text | colored.html | colored.ansi
```

## Sample

```
                        .:------:.
                     .:*@@@@@@@@@@*-.
                    :%@@@@@@@@@@@@@@%-
                   =@@@@@@@@@@@@@@@@@@+
                  -@@@%%%%%%%%%%%%%%%@@=
                 .%%*+==**=:--:=**==+*#%:
                   :#*+==---=+----=++#-
                     :#*++=+**+=++*#-
                         .#%%%%#.
                       :@@@@@@@@@@-
                    .*@@@@@@@@@@@@@@#.
                  =@@@@@@@@@@@@@@@@@@@@=
               :%@@@@@@@@@@@@@@@@@@@@@@@@%:
            .+@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*.
          -@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@=
```

`--style portrait` for people · `--style relief` for silhouettes · `--quality high` for detail · `--color` for ANSI/HTML color

## License

MIT
