"""Author the dog lesson from the owner's drawing video; no external dependencies."""
import json
from pathlib import Path

base=Path(__file__).resolve().parents[1]
pencils=json.loads((base/'pencils.json').read_text(encoding='utf-8'))
steps=[]
def stroke(title,paths,tool='black'):
    steps.append(dict(kind='stroke',title=title,paths=paths if isinstance(paths,list) else [paths],tool=tool))
def color(title,d,tool,clip=None,overlay=False):
    step=dict(kind='color',title=title,d=d,tool=tool,fill=pencils[tool]['color'])
    if clip:step['clip']=clip
    if overlay:step['overlay']=True
    steps.append(step)

# Coordinates follow the unobstructed frame at 78 s (1280 x 720).
head='M 508 254 C 511 224 538 201 571 196 C 610 187 651 203 669 234 C 687 268 670 303 644 324 C 612 352 568 372 524 376 C 491 380 461 374 446 357 C 434 345 429 329 429 312 C 427 296 437 282 454 273 C 469 264 491 258 508 254'
head_shape=head+' L 508 254 Z'
ear1='M 539 205 C 545 181 556 155 567 143 C 575 142 582 174 593 194'
ear2='M 631 202 C 642 182 655 163 665 157 C 672 153 675 194 677 215 Q 679 231 674 242'
eye1='M 526 233 C 518 238 515 252 520 259 C 525 269 535 260 540 247 C 545 235 536 228 526 233 Z'
eye2='M 594 241 C 585 248 581 264 587 274 C 595 286 608 272 611 258 C 615 246 605 237 598 242 Q 596 239 594 241 Z'
nose='M 449 282 C 436 278 426 291 426 306 C 426 323 436 330 450 325 C 468 321 471 303 463 291 Q 459 285 449 282 Z'
highlight1='M 531 237 Q 527 237 526 242 Q 531 244 533 239 Z'
highlight2='M 601 246 Q 596 246 595 252 Q 600 254 603 249 Z'
highlight3='M 450 291 Q 441 289 438 296 Q 441 299 445 295 Q 450 296 450 291 Z'
collar='M 557 374 L 566 405 C 605 399 647 380 673 354 Q 674 339 654 319'
collar_shape='M 557 374 L 566 405 C 605 399 647 380 673 354 Q 674 339 654 319 C 627 344 589 364 557 374 Z'
body_top='M 671 347 C 724 336 777 330 812 344 C 844 354 860 380 856 406 Q 855 425 849 434'
body_bottom='M 849 434 C 838 463 806 482 762 489 C 704 500 633 498 591 484 C 562 474 552 442 566 405'
body_shape='M 566 405 C 552 442 562 474 591 484 C 633 498 704 500 762 489 C 806 482 838 463 849 434 Q 855 425 856 406 C 860 380 844 354 812 344 C 777 330 724 336 671 347 L 673 354 C 647 380 605 399 566 405 Z'
tail='M 806 342 C 824 329 840 304 838 288 C 836 271 819 269 807 275 Q 796 279 791 288 C 773 283 769 269 776 252 C 790 222 819 220 840 232 C 866 246 886 270 881 299 C 878 327 860 354 840 364'
tail_shape=tail+' C 830 354 818 347 806 342 Z'
front1='M 562 449 C 567 483 551 514 536 536 C 525 552 534 571 550 573 C 574 577 592 550 603 524 Q 610 506 605 489'
front1_shape=front1+' C 580 480 566 468 562 449 Z'
front2='M 611 490 C 623 520 603 546 595 564 C 586 584 600 592 615 588 C 645 581 670 536 670 496'
front2_shape=front2+' Q 635 496 611 490 Z'
rear1='M 731 496 C 729 515 750 523 753 543 C 755 552 747 564 755 572 C 766 586 785 574 797 563'
rear1_shape=rear1+' C 797 542 791 520 774 506 Q 766 500 762 489 Q 748 493 731 496 Z'
rear2='M 759 421 C 742 452 750 479 765 497 C 782 512 793 516 798 538 C 802 555 790 572 804 580 C 816 592 838 560 848 535 C 864 501 864 468 849 442'
rear2_shape=rear2+' C 832 466 806 482 762 489 C 750 468 745 447 759 421 Z'

stroke('Округлая голова и мордочка',head)
stroke('Левое остренькое ушко',ear1)
stroke('Правое остренькое ушко',ear2)
stroke('Первый глаз',eye1)
color('Чёрный первый глаз, оставляем блик',eye1+' '+highlight1,'black')
stroke('Второй глаз',eye2)
color('Чёрный второй глаз, оставляем блик',eye2+' '+highlight2,'black')
stroke('Круглый носик',nose)
color('Чёрный носик, оставляем блик',nose+' '+highlight3,'black')
stroke('Добрая улыбка','M 466 350 C 495 369 556 365 588 325')
stroke('Ошейник',collar)
stroke('Спинка',body_top)
stroke('Животик',body_bottom)
stroke('Загнутый хвостик',tail)
stroke('Первая передняя лапка',front1)
stroke('Пальчики первой лапки',['M 536 559 Q 539 548 546 546','M 546 568 Q 548 555 558 551'])
stroke('Вторая передняя лапка',front2)
stroke('Пальчики второй лапки',['M 600 578 Q 599 565 607 559','M 613 585 Q 613 571 622 566'])
stroke('Дальняя задняя лапка',rear1)
stroke('Пальчики дальней лапки',['M 755 567 Q 756 557 763 554','M 766 575 Q 765 563 773 560'])
stroke('Ближняя задняя лапка',rear2)
stroke('Пальчики ближней лапки',['M 797 571 Q 797 560 804 554','M 807 581 Q 807 566 815 563'])

color('Жёлтая мордочка — вокруг глаз и носа',head_shape+' '+eye1+' '+eye2+' '+nose,'yellow')
color('Жёлтое левое ушко',ear1+' Q 566 192 593 194 L 539 205 Z','yellow')
color('Жёлтое правое ушко',ear2+' C 662 222 649 209 631 202 Z','yellow')
color('Жёлтый хвостик',tail_shape,'yellow')
color('Жёлтое туловище',body_shape,'yellow')
for title,path in [('первая передняя лапка',front1_shape),('вторая передняя лапка',front2_shape),('дальняя задняя лапка',rear1_shape),('ближняя задняя лапка',rear2_shape)]:
    color('Жёлтая '+title,path,'yellow')

# Thin warm markings rather than the video's loose, out-of-outline pastel scribbles.
color('Оранжевая серединка левого ушка','M 548 198 Q 558 168 567 153 Q 573 172 582 193 Q 564 192 548 198 Z','orange')
color('Оранжевая серединка правого ушка','M 639 201 Q 654 177 665 165 L 671 222 Q 656 208 639 201 Z','orange')
color('Рыжие полоски на лбу','M 551 196 Q 548 213 539 226 Q 556 218 560 195 Z M 577 194 Q 573 213 566 222 Q 581 217 586 195 Z M 600 197 Q 600 211 592 224 Q 607 217 610 199 Z', 'orange',head_shape)
color('Рыжие полоски на щёчке','M 653 218 Q 635 222 626 231 Q 643 229 664 234 Z M 670 246 Q 645 244 630 252 Q 652 255 674 259 Z M 672 271 Q 648 262 631 268 Q 649 280 666 286 Z M 655 301 Q 638 281 623 283 Q 631 299 646 312 Z','orange',head_shape)
color('Тёплая тень под мордочкой','M 431 325 C 443 365 481 379 525 371 C 554 368 578 358 600 347 L 595 341 C 560 363 522 369 482 364 C 457 361 442 346 437 326 Z','orange',head_shape)
color('Рыжие полоски на хвостике','M 779 241 Q 796 243 801 268 L 809 273 Q 807 247 792 231 Z M 815 226 Q 828 249 826 273 L 837 281 Q 844 247 828 228 Z M 849 240 Q 854 263 838 293 L 835 310 Q 866 282 864 257 Z M 879 283 Q 864 316 820 331 L 808 342 L 823 352 Q 865 337 881 312 Z','orange',tail_shape)
color('Рыжие полоски на спинке','M 683 342 Q 697 361 718 367 Q 695 369 675 353 Z M 715 336 Q 730 352 753 359 Q 728 364 709 343 Z M 753 335 Q 768 348 790 353 Q 769 360 748 343 Z M 791 338 Q 807 352 828 359 Q 807 365 787 347 Z','orange',body_shape)
color('Рыжие полоски на боках','M 575 416 Q 597 431 617 431 Q 593 440 570 430 Z M 628 378 Q 652 391 678 387 Q 653 402 630 389 Z M 668 421 Q 695 435 722 426 Q 701 444 674 433 Z M 740 375 Q 768 389 791 378 Q 775 400 747 389 Z M 806 397 Q 824 410 851 408 L 850 422 Q 823 427 806 408 Z M 611 461 Q 641 475 664 467 Q 644 484 617 473 Z M 704 464 Q 726 477 749 465 Q 738 487 714 479 Z M 784 443 Q 809 454 834 437 Q 822 459 794 457 Z','orange',body_shape)
for title,shape,paths in [
 ('передних лапках',front1_shape+' '+front2_shape,'M 552 497 Q 572 506 605 504 L 602 515 Q 574 518 547 509 Z M 534 538 Q 552 549 578 545 L 569 557 Q 546 560 534 548 Z M 613 523 Q 636 530 664 520 L 659 535 Q 639 542 608 535 Z M 598 561 Q 618 569 641 559 L 632 573 Q 616 580 595 573 Z'),
 ('задних лапках',rear1_shape+' '+rear2_shape,'M 738 514 Q 763 523 789 515 L 798 527 Q 775 538 748 526 Z M 752 547 Q 770 552 792 544 L 796 554 Q 773 566 752 557 Z M 810 477 Q 831 487 858 479 L 859 492 Q 837 501 812 489 Z M 803 516 Q 826 531 851 520 L 845 537 Q 823 545 806 530 Z M 800 553 Q 817 564 836 554 L 829 567 Q 812 579 798 565 Z')]:
    color('Рыжие полоски на '+title,paths,'orange',shape)
color('Красный ошейник',collar_shape,'red')

# Separate short, continuous green strokes form the lawn, like the original.
for i,(x,y) in enumerate([(437,605),(478,605),(675,605),(707,605),(865,605),(895,605)]):
    d=f'M {x} {y} q -11 -20 -6 -25 q 6 -4 14 24 q -2 -37 5 -38 q 7 0 5 36 q 8 -30 15 -29 q 7 4 -7 34'
    stroke(f'Травка — пучок {i+1}',d,'green')

lesson=dict(id='dog',title='Собачка',viewBox='400 118 530 505',palette=['black','yellow','orange','red','green'],steps=steps,
 source=dict(url='https://drive.google.com/file/d/1CDOHzsdyq1gN8gthBAlObKIJKxpYxxk6/view',durationSeconds=236.018,referenceFrameSeconds=78,note='Ручная реконструкция по видео владельца. Пастель адаптирована к карандашной штриховке.'))
(base/'lessons/dog.json').write_text(json.dumps(lesson,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Built dog lesson: {len(steps)} steps')
