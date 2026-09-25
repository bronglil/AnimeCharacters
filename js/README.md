# anime-ascii

Convert images to ASCII art (Node.js).

```bash
npm install
npx anime-ascii photo.png -w 58 --style portrait -r classic
```

```js
import { convertPath } from "anime-ascii";

console.log(
  await convertPath("photo.png", { columns: 58, style: "portrait", ramp: "classic" }),
);
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

`--style portrait` for people · `--style relief` for silhouettes · `--quality high` for detail

## License

MIT
