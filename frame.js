'use strict' 

const fs = require('fs');
let PDFDocument = require("pdfkit");

const env = {
    extended: false,
}

const color = {
    blue:   "#233C75",
    red:    "#e02010",
    //orange: "#c55614",
    orange: "#cf8621",
    yellow: "#f9e337",
    grey:   "#808080",
}

process.argv.forEach( (e, i) => {
    if (e === '--extended') env.extended = true
})

let trim = function(txt, shift) {
    if (shift) {
        if (shift > 0) {
            return txt.substring(shift, txt.length).trim()
        }
        return txt.trim()
    } else {
        return txt.trim()
    }
}

let cut = function(txt, substring) {
    let rexp = new RegExp(substring);
    return txt.replace(rexp,'').trim();
}

let cutAll = function(txt, substring) {
    let rexp = new RegExp(substring, 'g');
    return txt.replace(rexp,'').trim();
}

let match = function(txt, substring) {
    return txt.startsWith(substring)
}

let cg = JSON.parse(fs.readFileSync('cv.json', 'utf8'));

// read and parse content
let cv = {
    name: 'Unknown',
    summary: {
        ls: [],
    },
    experience: {
        ijobs: 0,
        jobs: [],
    },
    skills: {
        ls: [],
    },
    education: {
        ls: [],
    },
}
let cvText = fs.readFileSync('cv.md', 'utf8')
let cvl = cvText.split(/\r?\n/);

function matchKey(l) {
    const i = l.indexOf(':')
    if (i > 0) {
        const lk = l.substring(0, i).trim()
        const key = lk.substring(0, 1).toLowerCase() + lk.substring(1)
        const val = l.substring(i + 1).trim()
        //console.log('KEY ' + key + ': [' + val + ']')
        cv[key] = val
    }
}

let state = 0
cvl.forEach(l => {
    l = trim(l)

    if (l.startsWith('===')) {
        cv.name = cutAll(l, '===')
    } else if (l.startsWith('# Summary:')) {
        state = 1
    } else if (l.startsWith('# Experience:')) {
        state = 2
    } else if (l.startsWith('# Skills:')) {
        state = 3
    } else if (l.startsWith('# Education:')) {
        state = 4
    } else if (l.startsWith('# End')) {
        state = 5
    } else if (l.startsWith('#')) {
        // ignoring the comment line
    } else {
        switch (state) {
        case 0:
            matchKey(l)
            break
        case 1:
            cv.summary.ls.push(l)
            break;
        case 2:
            if (match(l, '* ')) {
                // job tag
                l = cut(l, '\\*')
                let tags = l.split('==').map(t => t.trim())
                cv.experience.jobs.push({
                    company: tags[0],
                    position: tags[1],
                    timeline: tags[2],
                    ls: [],
                })
                cv.experience.ijobs++
            } else {
                if (cv.experience.ijobs > 0) {
                    cv.experience.jobs[cv.experience.ijobs-1].ls.push(l.trim())
                }
            }
            break;
        case 3:
            l = cut(l, '\\*')
            cv.skills.ls.push(l)
            break;
        case 4:
            l = cut(l, '\\*')
            cv.education.ls.push(l)
            break;
        default:
            //console.log("IGNORING: " + l)
        }
    }
})

// create a document
let doc = new PDFDocument({
    layout: 'portrait',
    //layout: 'landscape',
    //size: [180, 252],
    //size: [419.53, 595.28], // A5
    size: [cg.pageWidth, cg.pageHeight], // A4
    //margin: 0,
    margins: {
        top: cg.margin.top,
        bottom: cg.margin.bottom,
        left: cg.margin.left,
        right: cg.margin.right,
    }
})
doc.pipe(fs.createWriteStream('cv.pdf'));
// register a font
doc.registerFont('main', 'font/Calibri.ttf')
doc.registerFont('bold', 'font/CalibriB.ttf')
doc.registerFont('italic', 'font/CalibriI.ttf')
//doc.registerFont('main', 'font/neuropol.ttf')
//doc.registerFont('main', 'font/november.ttf')

// extend doc
let isSpecial = function(ch) {
    return (ch === '*') || (ch === '_')
}

let segment = function(src, pos) {
    let buf = ''
    let startPos = pos
    let state = 0

    while(pos < src.length) {
        let ch = src.charAt(pos)

        if (state === 0) {
            if (ch === '*') {
                pos++
                return {
                    type: 'bold',
                    length: 1,
                }
            } else if (ch === '_') {
                pos++
                return {
                    type: 'italic',
                    length: 1,
                }
            } else {
                state = 1
            }
        } else if (state === 1) {
            if (pos === src.length || isSpecial(ch)) {
                return {
                    type: 'text',
                    length: pos-startPos,
                    text: buf,
                }
            } else {
                buf += ch
                pos++
            }
        }
    }

    return {
        type: 'final',
        length: pos - startPos,
        text: buf
    }
}
doc.mdtext = function(text, x) {
    this.x = x
    let pos = 0
    let flag = {
        bold: false, 
        italic: false,
    }

    let s
    do {
        s = segment(text, pos)
        pos += s.length

        switch(s.type) {
        case 'text':
            this.text(s.text, this.x, this.y, {
                continued: true,
            })
            break;
        case 'bold':
            flag.bold = !flag.bold
            if (flag.bold) this.font('bold')
            else this.font('main')
            break;
        case 'italic':
            flag.italic = !flag.italic
            if (flag.italic) this.font('italic')
            else this.font('main')
            break;
        case 'final':
            this.text(s.text, x, this.y)
            break;
        }
    } while (s.type !== 'final')
}

doc.shiftDown = function(val) {
    this.y += val
    return this
}
doc.vline = function(x, y1, y2, color) {
    this
        .lineWidth(2)
        .lineCap('square')
        .moveTo(x, y1)
        .lineTo(x, y2)
        .strokeColor(color)
        .stroke()
    return this
}
doc.hline = function(x1, x2, y, color) {
    this
        .lineWidth(0.5)
        .lineCap('square')
        .moveTo(x1, y)
        .lineTo(x2, y)
        .strokeColor(color)
        .stroke()
    return this
}
doc.outerFrame = function() {
    doc
        .strokeColor('#b0b0b0')
        .rect(5, 5, cg.pageWidth-10, cg.pageHeight-10)
        .stroke()
}


// commence doc generation
doc.outerFrame()
doc.on('pageAdded', () => {
    doc.outerFrame()
})

// photo
doc.image('img/profile.png', 25, 20, {
    width: 40,
    height: 75,
})

/*
// logo
doc.image('img/luxoft-tagline.jpg', cg.pageWidth-20-250, 20, {
    width: 250,
    height: 60,
    })
*/

doc
    // name
    .font('main')
    .fontSize(24)
    .fillColor(color.grey)
    .text(cv.name, 80, 35, {
        align: 'left',
    })

    // title
    .fontSize(16)
    .fillColor(color.orange)
    .text(cv.title, 80, 70, {
        align: 'left',
    })


// location & contacts
if (env.extended) {
    // with phone
    doc
        .fontSize(cg.textSize)
        .fillColor("#808080")
        .text(cv.location, 80, 60, {
            align: 'right',
        })

        // contacts
        .text('  <' + cv.contacts + '>', 80, 75, {
            align: 'right',
        })

        // phone
        .text(cv.phone, 80, 90, {
            align: 'right',
        })
} else {
    doc
        // no phone
        .fontSize(cg.textSize)
        .fillColor("#808080")
        .text(cv.location, 80, 68, {
            align: 'right',
        })

        // contacts
        .text('  <' + cv.contacts + '>', 80, 85, {
            align: 'right',
        })
}


// summary
/*
doc
    .fontSize(cg.textSize + 1)
    .fillColor("#202020")
    .text('Summary', 80, 80)
*/
doc
    .fontSize(cg.textSize + 2)
    .fillColor('#505050')
    .text('', 80, 110)
cv.summary.ls.forEach(l => doc.mdtext(l + '\n', 80))

let baseX = cg.baseX
let xseparator = cg.titleWidth
let xspace = 10

// experience
doc
    .fontSize(cg.titleTextSize)
    .fillColor(color.blue)
    .shiftDown(cg.sectionIdent)
    .mdtext('Experience', baseX)
let startY = doc.y

doc
    .fontSize(cg.textSize)
    .fillColor("black")
    .shiftDown(cg.subSectionIdent)

let curY = doc.y
cv.experience.jobs.forEach(job => {
    let baseY = doc.y

    doc
        .fontSize(cg.textSize+2)
        .fillColor(color.blue)
        .mdtext(job.company, baseX)
    doc
        .fontSize(cg.textSize)
        .fillColor(color.grey)
        .mdtext(job.timeline, baseX)

    const lines = job.position.split('|')
    lines.forEach(line => {
        doc
            .fontSize(cg.textSize+2)
            .fillColor(color.orange)
            .mdtext(line, baseX)
    })

    let maxY = doc.y

    doc.y = baseY
    doc
        .fontSize(cg.textSize)
        .fillColor("black")

    job.ls.forEach(l => doc.mdtext(l + '\n', xseparator + xspace))

    if (doc.y < maxY) doc.y = maxY
    doc.vline(xseparator, baseY, doc.y-5, color.blue)

    doc.shiftDown(cg.jobIdent)

})
//doc.vline(xseparator, startY, doc.y, color.blue)

// skills
doc.shiftDown(cg.sectionIdent)
doc
    .fontSize(cg.titleTextSize)
    .fillColor(color.blue)
    .shiftDown(cg.sectionIdent)
    .mdtext('Skills', baseX)
startY = doc.y

doc
    .fontSize(cg.textSize)
    .fillColor("black")
cv.skills.ls.forEach(l => doc.mdtext(l + '\n', xseparator + xspace))
doc.vline(xseparator, startY, doc.y, color.red)

// education
doc
    .fontSize(cg.titleTextSize)
    .fillColor(color.blue)
    .shiftDown(cg.sectionIdent)
    .mdtext('Education', baseX)
startY = doc.y

doc
    .fontSize(cg.textSize)
    .fillColor("black")
cv.education.ls.forEach(l => doc.mdtext(l + '\n', xseparator + xspace))
doc.vline(xseparator, startY, doc.y, color.yellow)


// github
{
    let height = doc.currentLineHeight();
    let x = cg.pageWidth - 170
    let y = cg.pageHeight - 80

    doc
        .fontSize(cg.titleTextSize)
        .fillColor(color.grey)
        .text('Links', x, y)

    // home page
    y += 22
    let width = doc.widthOfString(cv.homePage);
    doc
        .fontSize(12)
        .fillColor(color.blue)
        .text(cv.homePage, x, y)
        //.underline(x, y, width, height, { color: "#0000FF" })
        .link(x, y, width, height, cv.homePage)

    // github
    y += 15
    width = doc.widthOfString(cv.gitHub);
    doc
        .fillColor(color.blue)
        .text(cv.gitHub, x, y)
        //.underline(x, y, width, height, { color: "#0000FF" })
        .link(x, y, width, height, cv.gitHub)
}

// finalize PDF file
doc.end()

