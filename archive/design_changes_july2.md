This is a document used to evaluate the design of the current system and implement new better designs after testing the system.

The goal of the system is to create an environment of meaningful creative constraints for digital collage. the way in which this environment is created is through a custom built deck of cards, with different specific actions on them. only the action that is on the card can be performed at that time, like erasing, color changing, adding noise via brush, or adding blur via brush, cropping and flattening the layers, etc. these are all examples of individual constraints. the UI also gets constrained, so only the relevant UI elements that are associated with that card are visible.

A simple version of this was already built. in testing, here were the things that did not work:

the first draw is always a card that adds between 1 and 3 images. there are 3 cards, add 1, add 2, add 3. then the modifier cards are added in and the deck is shuffled. there weren't many modifier cards, so the add cards would continue to appear, and there would be too many additions of images that you would sort of give up on making it look good, since it was over crowded and the addition of images felt cheap.  this system needs to be re-thought.

my thought is this: there are two "rolls" or "draws" - ideally the cards have some sort of subsidiary numbder system on them, so that i can draw them as dice rolls as well. there are two draws/rolls in the beginning to determine 1. how many images are available to pick from in a grid, and then 2. how many you get to choose out of the ones that are available. the grid roll should be bigger than the choice roll by a lot. the grid roll should be between 8 and 16 or something like that. and then you can only pick between 1 and 4, or 2 and 4. so the early choice decision is key for how you are going to work on it.

 I think there should also be a  mechanic for being able to "stash" some of them to appear later on in the sequence.

 so the beginning phase - you get a randomly rolled sized grid of images from the server, and a rolled amount of images you are able to choose from. minimum is two, maximum is 4 or 6? and then when you have chosen, you can choose to stash as many as you want to appear later on in the mid phase. so say you roll a choose 3, and then you stash 2, and place 1. that is your beginning phase done. 

 there are no more "add 1, add 2, add 3" cards in the card deck. the adding of images is done in this specific way in the beginning. all of the rest of the cards are about modification. 

 the philosophy for all modification cards is that they are a constraint, but they also give you freedom within that constraint. no card should ever feel like it just does something and then you see it be done to your image. like the flip canvas card for example is a bad card that is currently in there, because it just does it for you. in order for it to be a good card, it should give you a set of options within the constraint of flipping, like being able to flip horizontal or vertical, or for even more control, be called the "reposition" card, which allows you to flip, rotate, and zoom the canvas however you feel is right. that would be more of an in-depth decision. 

 Another example is with a blur. instead of blurring the whole canvas, it should be done with a brush. you can determine the width and the opacity/dennsity of the blur, the brush size etc. you should be able to undo/redo. that way you can really get into the act of using a blur brush and really work through the contstraints of that sequence in a painterly way. perhaps there are more brush types and you can try out all kinds of brush types or stamps that stamp a pattern of blur on to the canvas for instance. give anough control within each card to have a short session of intentional editing, before moving on.


 new philosophy. everything should be destructive. there should be no active layers that persist between cards. however the canvas is when you press next card, is how it will be as a single layer. I think there is a re-shuffle layers card in our deck currently, but it doesnt make sense, because when you positioned them initially, you did so intentionally, so re-ordering them feels like an unnecessary regression. 


 this being said - a huge part of the collage process is the act of placing layers and then being able to mask/delete their hard square edges with a soft round brush. so a meaningful constraint is this - whenever a layer or layers are being places of images, you should ALWAYS be able to use a hard or soft brush to be able to erase them in the process, so that you can layer two images on top of each other and then meaningfully remove some material from the top one to reveal the bottom one for example. 



 here is a concept for a more opinionated, multi-sequence card that mirrors my own style of working. "add new image as screen blend mode". here is how it would go:

 you get a fresh grid of lets say 8 images from the server. you pick one and it is brought onto the canvas with a screen blend mode applied to it. you have control over the whole opacity, brightness/contrast, and an erase tool that also has opacity. 
 this card produces the same treatment on the canvas. this sequence produces a ghostly overlay on the canvas with a lightly opaque, screen blend moded addition. when you hit next turn, this gets destructively applied to the canvas and everything gets flattened to the single image. this card should be called the "ghost" card. 


 there should be no global modifiers on the entire canvas, with the exception of color adjustments. and those color adjustment global modifier cards should have ample control. two examples, color overlay - choose froma color picker to tint the entire canvas. opacity allows you to choose a percentage of influence on the canvas. so this can color tint it onlyever so slightly, or you can douse it in a color wash. same with an HSV card. this can be applied to the whole canvas, but also with an opacity /quantity slider so that it is able to be done with significant control over quantity of influence. 

 we need to decide what amount of cards of influence are drawn in the middle section after the initial grid choices of images in the beginning happens, and then how the end-state is created. my instinct is that there are at least 3-4 rounds of modifications, and then the stashed images are introduced to the canvas. then a few more rounds of modifications, and then a series of death cards are shuffled in to the deck, so you can continue modifying, but if you hit a death card the canvas is complete. this is up for debate as to how to make this sequence work well, but this is my instinct for now. we can make a plan about it and make choices. 


i will now list out card ideas:

"ghost" - see above
"stamp"- pick from a grid of 6 images from the server, cut out as a png with rembg, and then put it on the canvas. you can scale, rotate, and opacity, and also erase. 

"rails" - take an image at random, and do some sort of edge detection/clamping on the color palette so that only a certain amount of color is available, use that to determine the alpha of that image. so it looks like a patchwork cutout of itself. it is given a solid color, and you can scale it up or down as much as you want. the idea is that you would also stamp this on to the canvas to create some random line work or division of the space of the canvas. it would have a color picker for its solid color, as well as an opacity. andyou would be able to erase it.

"noise" - noise applied as a brush, either soft or round. you can dial up or down the intensity on a slider, and draw different amounts of intensity or opacity per stroke. really compose with it. then once finished it is applied to the canvas. for these brush like effects, since everything ends up as a flattened canvas on each round, they can be built like this: the canvas is duplicated and fully masked out. when you draw you are drawing the mask back in on the invisible noise layer over top. same can be said for a blurbrush or an HSV brush, or any other effect brush. unless there is a better way.

"deeper" this is a crop/zoom. choose an area on the canvas and zoom/rotate into it. you can change the crop of the entire canvas. once you pick your new place, you, commit it and move to the next card. ideally this is where we can incorporate esrGan into the design, where it will do a 4x upscale on your canvas at that new position to add detail. the upscale wont change your new crop position, it will just add detail into your zoomed in area. creating abstraction through zoom/crop/and upscale will be a big way we will be modifying the canvas. 

there is no drawing cards, like a pencil card or a paintbrush card. all modification to the canvas is done via effects, resampling, brushing on effects, zooming and cropping and upscaling and stamping on new images, adding images with blend modes and masks, etc. 


given everything that is already built into the project, lets assess the current state of it and how to commit to the new approach, planning out the changes, thinking about the card approach and how to add new cards to the mix given this multi-step approach to an oppinionated sequence of actions, and how the UI will shift given the new grid choices of images constraint. how to incorporate tools like rembg and esrgan into the tool and run them locally.

ask any clarifying questions about the vision, and then lets write all of this out into a robust, multi phase plan of attack.
