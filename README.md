# anime-ascii

Convert images to ASCII art (Node.js). Fast by default (~30ms).

```bash
cd js && npm install
npx anime-ascii photo.png -w 58 --style portrait -r classic
```

```js
import { convertPath } from "anime-ascii";

const art = await convertPath("photo.png", {
  columns: 58,
  style: "portrait", // best for people
  ramp: "classic",
});
console.log(art);
```

## Sample (`style: "portrait"`)

```
                        .:------:.
                     .:*@@@@@@@@@@*-.
                    :%@@@@@@@@@@@@@@%-
                   =@@@@@@@@@@@@@@@@@@+
                  -@@@%%%%%%%%%%%%%%%@@=
                 .%%#++=-----------=+*#%.
                 .%%*+==**=:--:=**==+*#%:
                  .##*+=++--+*--++==+*#.
                   :#*+==---=+----=++#-
                    -#*+==-====-==++#-
                     :#*++=+**+=++*#-
                      .+#*++==++*#*:
                        :+##**##+:
                         .#%%%%#.
                          *#####.
                       :@@@@@@@@@@-
                      =@@@@@@@@@@@@+.
                    .*@@@@@@@@@@@@@@#.
                   :%@@@@@@@@@@@@@@@@@-
                  =@@@@@@@@@@@@@@@@@@@@=
                .+@@@@@@@@@@@@@@@@@@@@@@*.
               :%@@@@@@@@@@@@@@@@@@@@@@@@%:
              -@@@@@@@@@@@@@@@@@@@@@@@@@@@@=
            .+@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*.
           .#@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@%:
          -@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@=
```

Use `--style portrait` for photos of people. `--style relief` for flat silhouettes. `--quality high` for max detail.

## License

MIT
