"""Snowman in glasses: hand-authored lesson from the owner's 15-second video."""
import json
import re
from pathlib import Path

base=Path(__file__).resolve().parents[1]
pencils=json.loads((base/'pencils.json').read_text(encoding='utf-8'))
steps=[]
def stroke(title,paths,tool='black'):
    steps.append(dict(kind='stroke',title=title,paths=paths if isinstance(paths,list) else [paths],tool=tool))
def color(title,d,tool,clip=None):
    step=dict(kind='color',title=title,d=d,fill=pencils[tool]['color'],tool=tool)
    if clip:step['clip']=clip
    steps.append(step)

scarf='M 259 669 Q 260 663 269 663 L 397 661 Q 398 651 409 651 L 445 650 Q 456 651 457 665 L 456 757 Q 456 771 443 772 L 410 774 Q 398 774 399 761 L 403 719 L 270 722 Q 254 721 256 707 L 259 669 Z'
body='M 256 707 C 220 727 204 774 207 816 C 206 877 255 928 313 946 C 374 965 424 945 466 915 C 511 885 529 829 514 782 C 507 750 482 718 456.571 704'
body_shape=body+' L 456 757 Q 456 771 443 772 L 410 774 Q 398 774 399 761 L 403 719 L 270 722 Q 257 721 253 708 Z'
head='M 269 663 C 240 640 228 603 233 556 C 236 523 249 501 277 497 C 339 480 410 485 469 514 C 489 545 491 615 445 650'
head_shape=head+' L 409 651 Q 398 651 397 661 L 269 663 Z'
# Each new hat outline is one uninterrupted movement between two existing anchors.
brim_outline='M 277 497 Q 284 472 312 450 C 375 448 443 472 504 500 Q 486 502 469 514'
brim=brim_outline+' C 410 485 339 480 277 497 Z'
hat='M 312 450 C 359 432 430 420 472 429 C 507 432 520 445 528 477 L 544 507 L 504 500'
hat_shape=hat+' C 443 472 375 448 312 450 Z'
pom='M 531.2 483 C 557 473 580 492 583 508 C 590 532 567 551 544 555 C 520 559 504 542 508 527 L 511 501.225'
pom_shape=pom+' L 544 507 L 531.2 483 Z'
glasses='M 280 504 C 259 505 245 514 240 535 C 232 553 233 587 238 602 C 241 615 255 620 274 617 L 309 610 Q 321 607 326 591 Q 331 578 340 578 L 354 578 Q 368 580 371 592 C 374 609 384 620 402 619 L 437 617 C 459 615 469 606 468 584 L 466 542 C 467 519 459 506 444 504 C 426 501 407 502 394 505 Q 382 507 376 522 L 372 537 Q 361 545 346 546 Q 335 547 333 534 L 331 523 C 329 505 319 502 304 503 L 280 504 Z'
lens1='M 277 519 C 259 519 252 526 250 545 L 248 580 C 247 598 254 603 269 601 L 304 595 Q 315 593 318 577 L 321 548 Q 322 531 313 523 C 303 518 290 518 277 519 Z'
lens2='M 399 519 C 389 521 384 529 385 546 L 386 584 Q 387 603 403 604 L 437 601 Q 453 599 454 582 L 452 544 Q 454 524 440 521 C 425 517 410 517 399 519 Z'
eye1='M 291 549 C 277 552 270 568 277 585 C 284 603 303 595 313 577 C 320 559 308 543 291 549 Z'
eye2='M 411 550 C 395 555 389 574 397 587 C 406 604 426 592 434 576 C 442 558 426 544 411 550 Z'
shine1='M 309 557 Q 297 557 299 565 Q 305 574 313 564 Q 315 559 309 557 Z'
shine2='M 427 558 Q 416 556 414 564 Q 419 575 429 569 Q 436 563 427 558 Z'
def glasses_y(d):
    # Absolute paths only; compress vertically to fit below the whole brim.
    coordinate=0
    def convert(match):
        nonlocal coordinate
        value=float(match.group())
        result=value if coordinate%2==0 else value*.78+130
        coordinate+=1
        return f'{result:g}'
    return re.sub(r'-?\d+(?:\.\d+)?',convert,d)
glasses,lens1,lens2,eye1,eye2,shine1,shine2=map(glasses_y,[glasses,lens1,lens2,eye1,eye2,shine1,shine2])
carrot='M 287 647 L 330 591 C 344 574 365 580 372 598 C 380 619 370 633 350 638 L 294 654 Q 284 657 287 647 Z'
mitten1='M 173 741 C 153 720 109 708 105 673 C 100 653 110 627 125 622 C 143 614 163 629 185 651 C 190 629 195 610 204 617 C 216 622 213 650 205 668 L 217 682 L 173 741 Z'
mitten2='M 485 676 L 503 632 Q 510 614 515 624 L 516 649 C 532 628 552 607 569 611 C 595 613 591 637 579 654 C 563 679 545 696 532 713 L 485 676 Z'
arm1='M 191 716 L 230 747 L 240 731 L 203 702 Z'
arm2='M 497 686 L 469 721 L 483 735 L 509 695 Z'
button1='M 352 736 C 333 736 329 754 338 766 C 349 782 370 768 370 753 C 370 740 364 733 352 736 Z'
button2='M 351 814 C 336 814 328 830 338 842 C 348 858 372 847 370 832 C 370 820 361 812 351 814 Z'

# Complete, recognisable units; never stop halfway through a contour to resume it in a later step.
stroke('Шарф целиком',scarf)
stroke('Складка шарфа','M 397 661 L 403 719')
stroke('Большой снежный ком',body)
stroke('Голова над шарфом — от края до края',head)
stroke('Целый отворот шапки на голове',brim_outline)
stroke('Верхняя часть шапки',hat)
stroke('Круглый помпон',pom)
stroke('Очки целиком — оправа и два окошка',[glasses,lens1,lens2])
stroke('Первый глаз',eye1)
color('Первый чёрный глаз с белым бликом',eye1+' '+shine1,'black')
stroke('Второй глаз',eye2)
color('Второй чёрный глаз с белым бликом',eye2+' '+shine2,'black')
stroke('Нос-морковка',carrot)
stroke('Улыбка','M 360 646 Q 382 650 396 631')
stroke('Верхняя пуговица',button1)
stroke('Нижняя пуговица',button2)
stroke('Левая ручка-веточка',arm1)
stroke('Левая варежка на ручке',mitten1)
stroke('Правая ручка-веточка',arm2)
stroke('Правая варежка на ручке',mitten2)

color('Красная шапка',hat_shape,'red')
color('Красный шарф вокруг шеи','M 397 661 L 269 663 Q 260 663 259 669 L 256 707 Q 254 721 270 722 L 403 719 Z','red')
color('Красный свисающий конец шарфа','M 397 661 Q 398 651 409 651 L 445 650 Q 456 651 457 665 L 456 757 Q 456 771 443 772 L 410 774 Q 398 774 399 761 L 403 719 L 397 661 Z','red')
color('Салатовая левая варежка',mitten1,'light_green')
color('Салатовая правая варежка',mitten2,'light_green')
color('Синяя оправа — стёкла остаются белыми',glasses+' '+lens1+' '+lens2,'blue')
color('Оранжевый нос-морковка',carrot,'orange')
color('Розовый отворот шапки',brim,'pink')
color('Розовый помпон',pom_shape,'pink')
stroke('Снежный сугроб слева','M 142 976 Q 164 951 193 957 Q 213 940 234 951 Q 255 937 278 947','pink')
stroke('Снежный сугроб справа','M 449 936 Q 471 928 486 938 Q 509 914 535 934 Q 560 920 580 943 Q 596 942 605 960','pink')
for i,(x,y,r) in enumerate([(156,467,19),(182,540,11),(565,790,19),(577,861,10)]):
    k=.55228475*r
    d=f'M {x-r} {y} C {x-r} {y-k} {x-k} {y-r} {x} {y-r} C {x+k} {y-r} {x+r} {y-k} {x+r} {y} C {x+r} {y+k} {x+k} {y+r} {x} {y+r} C {x-k} {y+r} {x-r} {y+k} {x-r} {y}'
    stroke(f'Снежинка-кружок {i+1}',d,'pink')
color('Коричневая левая веточка',arm1,'brown')
color('Коричневая правая веточка',arm2,'brown')
color('Коричневая верхняя пуговица',button1,'brown')
color('Коричневая нижняя пуговица',button2,'brown')
color('Лёгкая тень на снежном коме',body_shape+' M 268 738 C 234 760 221 797 233 838 C 243 895 286 930 350 934 C 415 943 461 912 486 867 C 507 820 494 756 469 738 L 469 765 Q 466 786 442 789 L 407 791 Q 381 790 383 763 L 385 738 Z','light_gray',body_shape)
color('Лёгкая тень по краю головы','M 233 556 C 228 603 240 640 264 663 L 278 663 C 253 638 243 613 244 590 L 241 555 Z M 455 655 Q 472 634 474 609 L 463 612 Q 460 634 444 650 Z','light_gray',head_shape)

lesson=dict(id='snowman_glasses',title='Снеговик в очках',viewBox='90 412 535 588',palette=['black','red','light_green','blue','orange','pink','brown','light_gray'],steps=steps,
 source=dict(url='https://drive.google.com/file/d/1pxa9_W1Dnj1BlfVCz5AwHNtdq66dzFGb/view',durationSeconds=15.08,referenceFrameSeconds=6.9,note='Ручная учебная адаптация видео владельца. Контуры и раскраска сгруппированы по карандашам; декоративный фон и логотип видео не включены.'))
(base/'lessons/snowman_glasses.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Built snowman lesson: {len(steps)} steps')
