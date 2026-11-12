"""Shared authoring geometry. Native frame coordinates; SVG exports at 2×."""
import math

def pt(p): return f'{p[0]*2:.6f} {p[1]*2:.6f}'
def move(p): return 'M '+pt(p)
def curve(c): return ' C '+' '.join(pt(p) for p in c[1:])
def chain(cs): return move(cs[0][0])+''.join(curve(c) for c in cs)
def line(a,b): return (a,tuple((2*x+y)/3 for x,y in zip(a,b)),tuple((x+2*y)/3 for x,y in zip(a,b)),b)
def reverse(cs): return [tuple(reversed(c)) for c in reversed(cs)]
def split(c,t):
    def mix(a,b): return tuple(x+(y-x)*t for x,y in zip(a,b))
    a,b,d=[mix(c[i],c[i+1]) for i in range(3)];e,f=mix(a,b),mix(b,d);g=mix(e,f)
    return (c[0],a,e,g),(g,f,d,c[3])
def at(c,t): return split(c,t)[0][-1]
def section(c,a,b): return split(split(c,b)[0],a/b)[1] if a else split(c,b)[0]
def length(cs): return sum(math.dist(at(c,i/20),at(c,(i+1)/20)) for c in cs for i in range(20))
def oval(x,y,rx,ry):
    k=.55228475
    return [((x-rx,y),(x-rx,y-k*ry),(x-k*rx,y-ry),(x,y-ry)),((x,y-ry),(x+k*rx,y-ry),(x+rx,y-k*ry),(x+rx,y)),((x+rx,y),(x+rx,y+k*ry),(x+k*rx,y+ry),(x,y+ry)),((x,y+ry),(x-k*rx,y+ry),(x-rx,y+k*ry),(x-rx,y))]
class Path:
    def __init__(self,cs): self.cs=[tuple(tuple(p) for p in c) for c in cs]
    def d(self,closed=False): return chain(self.cs)+(' Z' if closed else '')
    def nearest(self,p):
        _,i,t=min((sum((at(c,t)[n]-p[n])**2 for n in (0,1)),i,t) for i,c in enumerate(self.cs) for t in (j/500 for j in range(501)))
        # Refine the native-parameter search for precise shared boundaries.
        a,b=max(0,t-.003),min(1,t+.003)
        def dist(t): return math.dist(at(self.cs[i],t),p)
        for _ in range(25):
            l,r=a+(b-a)/3,b-(b-a)/3
            if dist(l)<dist(r): b=r
            else:a=l
        return i+(a+b)/2
    def point(self,u):
        i=min(int(u),len(self.cs)-1);return at(self.cs[i],u-i)
    def sub(self,a,b):
        if b<a: return self.sub(a,len(self.cs))+self.sub(0,b)
        out=[]
        for i,c in enumerate(self.cs):
            lo,hi=max(0,a-i),min(1,b-i)
            if hi-lo>1e-9:out.append(section(c,lo,hi))
        return out
    def short_arc(self,a,b):
        forward=self.sub(a,b);backward=reverse(self.sub(b,a))
        return forward if length(forward)<length(backward) else backward
    def attach_start(self,p): self.cs[0]=(p,*self.cs[0][1:])
    def attach_end(self,p): self.cs[-1]=(*self.cs[-1][:-1],p)
